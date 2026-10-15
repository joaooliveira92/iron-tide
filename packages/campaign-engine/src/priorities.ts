import { Schema } from "effect";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { scaleValue } from "@bluewave/campaign";
import { HIGH_TENSION_THRESHOLD, isHighTension } from "./diplomacy.js";
import { shipMaintenanceCost, totalPaidWork } from "./opening-briefing.js";
import { MIN_RESEARCH_SHARE_BP, NEAR_COMPLETION_WORK_RATIO } from "./priorityConstants.js";

/**
 * Immediate Priorities projection — INC-2 (spec §7).
 *
 * Pure, read-only derivation over the immutable `CampaignSnapshot` for the
 * player nation. Never wired into `MonthExecutor`; goldens stay byte-identical.
 * `HIGH_TENSION_THRESHOLD` / `isHighTension` are imported from `diplomacy.ts`
 * and never re-declared (INC-2 invariant).
 */

// Re-export the threshold for tests that want the single source of truth via this
// module without importing diplomacy directly (the canonical export remains there).
export { HIGH_TENSION_THRESHOLD, isHighTension } from "./diplomacy.js";

export interface InspectPrioritiesResult {
  readonly priorities: readonly StrategicPriority[];
}

export const prioritySeveritySchema = Schema.Literals([
  "information",
  "advisory",
  "warning",
  "critical",
]);
export type PrioritySeverity = typeof prioritySeveritySchema.Type;

export const strategicPriorityTypeSchema = Schema.Literals([
  "monthly_deficit",
  "critical_cash_reserve",
  "low_research_spending",
  "construction_near_completion",
  "high_foreign_tension",
  "no_active_construction",
]);
export type StrategicPriorityType = typeof strategicPriorityTypeSchema.Type;

export type StrategicDestinationSection =
  | "overview"
  | "construction"
  | "fleet"
  | "research"
  | "diplomacy";

export interface StrategicPriority {
  readonly id: string;
  readonly type: StrategicPriorityType;
  readonly severity: PrioritySeverity;
  readonly title: string;
  readonly summary: string;
  readonly reason: string;
  readonly destination: StrategicDestinationSection;
  readonly fingerprint: string;
}

// A priority plus the two numeric sort keys that depend on data the display
// fields do not expose (remaining work, tension). Captured at construction so
// the comparator never re-parses `reason`.
interface RankedPriority {
  readonly priority: StrategicPriority;
  readonly financialRisk: number;
  readonly timeToConsequence: number;
}

// Severity ordinal for the 5-key sort — higher is more urgent (critical first).
const SEVERITY_RANK: Record<PrioritySeverity, number> = {
  critical: 3,
  warning: 2,
  advisory: 1,
  information: 0,
};

// Fixed type order for the 4th sort key (the schema order itself).
const TYPE_ORDER: Record<StrategicPriorityType, number> = {
  monthly_deficit: 0,
  critical_cash_reserve: 1,
  low_research_spending: 2,
  construction_near_completion: 3,
  high_foreign_tension: 4,
  no_active_construction: 5,
};

function destinationForType(type: StrategicPriorityType): StrategicDestinationSection {
  switch (type) {
    case "monthly_deficit":
      return "overview";
    case "critical_cash_reserve":
      return "overview";
    case "low_research_spending":
      return "research";
    case "construction_near_completion":
      return "construction";
    case "high_foreign_tension":
      return "diplomacy";
    case "no_active_construction":
      return "construction";
  }
}

/**
 * Pure priorities projection — 6 of 8 doc types (spec §7).
 *
 * Cut with recorded reasons (never re-added):
 * - `obsolete_active_class` — no obsolescence score, no design→tech mapping.
 * - `construction_stalled` — per-project month-over-month delta not persisted.
 *
 * `construction_near_completion` is adapted to the work-ratio proxy
 * (`completedWork / totalWork >= 0.9`) since `computeConstructionCap` /
 * months-to-completion is underivable (compiler hardcodes baseResources 0).
 */
export function buildPrioritiesProjection(
  snapshot: CampaignSnapshot,
  playerNationId: string,
): readonly StrategicPriority[] {
  const nation = snapshot.nations.get(playerNationId);
  if (nation === undefined) return [];

  const ports = snapshot.world.ports.filter((p) => p.nationId === playerNationId);
  const shipyardCapacity = ports.reduce((sum, p) => sum + Number(p.level), 0);

  const monthlyAppropriation = Number(
    scaleValue(Number(nation.income), Number(nation.navalAppropriationRateBp)),
  );
  const researchSpend = Number(nation.research.researchBudget);
  const constructionSpend = totalPaidWork(nation);
  const fleetMaintenance = nation.fleets.reduce(
    (sum, fleet) =>
      sum + fleet.ships.reduce((s, ship) => s + shipMaintenanceCost(Number(ship.hitPoints)), 0),
    0,
  );
  const projectedBalance =
    monthlyAppropriation - fleetMaintenance - constructionSpend - researchSpend;
  const totalMonthlyExpenditure = fleetMaintenance + constructionSpend + researchSpend;
  const treasury = Number(nation.treasury);

  const ranked: RankedPriority[] = [];

  // 1. monthly_deficit — projectedBalance < 0
  if (projectedBalance < 0) {
    const critical = treasury + projectedBalance < 0;
    const severity: PrioritySeverity = critical ? "critical" : "warning";
    const fingerprint = "monthly_deficit";
    ranked.push({
      priority: {
        id: fingerprint,
        type: "monthly_deficit",
        severity,
        title: "Monthly deficit",
        summary: `Projected balance ${projectedBalance.toLocaleString()} — expenditure exceeds naval appropriation.`,
        reason: `monthly_deficit: appropriation ${monthlyAppropriation} − maintenance ${fleetMaintenance} − construction ${constructionSpend} − research ${researchSpend} = ${projectedBalance}; treasury ${treasury} ${critical ? "insolvent" : "still solvent"}`,
        destination: destinationForType("monthly_deficit"),
        fingerprint,
      },
      financialRisk: Math.abs(projectedBalance),
      timeToConsequence: treasury < 0 ? 0 : Math.floor(treasury / Math.abs(projectedBalance)),
    });
  }

  // 2. critical_cash_reserve — treasury < max(totalMonthlyExpenditure, 1)
  {
    const threshold = Math.max(totalMonthlyExpenditure, 1);
    if (treasury < threshold) {
      const fingerprint = "critical_cash_reserve";
      ranked.push({
        priority: {
          id: fingerprint,
          type: "critical_cash_reserve",
          severity: "warning",
          title: "Critical cash reserve",
          summary: `Treasury ${treasury.toLocaleString()} below one month's expenditure ${threshold.toLocaleString()}.`,
          reason: `critical_cash_reserve: treasury ${treasury} < max(totalMonthlyExpenditure ${totalMonthlyExpenditure}, 1) = ${threshold}`,
          destination: destinationForType("critical_cash_reserve"),
          fingerprint,
        },
        financialRisk: Math.max(threshold - treasury, 0),
        timeToConsequence: 0,
      });
    }
  }

  // 3. low_research_spending — researchShare < 800bp when appropriation > 0
  if (monthlyAppropriation > 0) {
    // Compare cross-multiplied to stay in integers: research*10_000 < appropriation*800
    if (researchSpend * 10_000 < monthlyAppropriation * MIN_RESEARCH_SHARE_BP) {
      const fingerprint = "low_research_spending";
      const expectedResearch = Math.floor((monthlyAppropriation * MIN_RESEARCH_SHARE_BP) / 10_000);
      ranked.push({
        priority: {
          id: fingerprint,
          type: "low_research_spending",
          severity: "warning",
          title: "Low research spending",
          summary: `Research ${researchSpend.toLocaleString()} is below ${MIN_RESEARCH_SHARE_BP / 100}% of naval appropriation ${monthlyAppropriation.toLocaleString()}.`,
          reason: `low_research_spending: researchSpend ${researchSpend} * 10_000 < monthlyAppropriation ${monthlyAppropriation} * ${MIN_RESEARCH_SHARE_BP}`,
          destination: destinationForType("low_research_spending"),
          fingerprint,
        },
        financialRisk: Math.max(expectedResearch - researchSpend, 0),
        timeToConsequence: Number.POSITIVE_INFINITY / 2,
      });
    }
  }

  // 4. construction_near_completion — per active project where completed/total >= 0.9
  for (const project of nation.constructionProjects) {
    if (project.status === "COMPLETED") continue;
    const total = Number(project.totalWork);
    const completed = Number(project.completedWork);
    if (total <= 0) continue;
    if (completed / total >= NEAR_COMPLETION_WORK_RATIO) {
      const fingerprint = `construction_near_completion:${project.id}`;
      ranked.push({
        priority: {
          id: fingerprint,
          type: "construction_near_completion",
          severity: "information",
          title: "Construction near completion",
          summary: `Project ${project.id} is ${((completed / total) * 100).toFixed(0)}% complete — reallocate yards on completion.`,
          reason: `construction_near_completion: project ${project.id} completedWork ${completed} / totalWork ${total} >= ${NEAR_COMPLETION_WORK_RATIO}`,
          destination: destinationForType("construction_near_completion"),
          fingerprint,
        },
        financialRisk: Math.max(total - completed, 0),
        timeToConsequence: 1 - completed / total,
      });
    }
  }

  // 5. high_foreign_tension — per relation where this nation is a party and tension >=8
  for (const rel of snapshot.politics.relations) {
    const isParty = rel.nationA === playerNationId || rel.nationB === playerNationId;
    if (!isParty) continue;
    if (!isHighTension(rel.tension)) continue;
    const partnerId = rel.nationA === playerNationId ? rel.nationB : rel.nationA;
    const fingerprint = `high_foreign_tension:${partnerId}`;
    // Deduplicate by partner (the spec's condition identity is per partner nation)
    if (ranked.some((r) => r.priority.fingerprint === fingerprint)) continue;
    ranked.push({
      priority: {
        id: fingerprint,
        type: "high_foreign_tension",
        severity: "warning",
        title: "High foreign tension",
        summary: `Tension with ${partnerId} is ${rel.tension} (high — threshold ${HIGH_TENSION_THRESHOLD}).`,
        reason: `high_foreign_tension: relation ${rel.nationA}/${rel.nationB} tension ${rel.tension} >= ${HIGH_TENSION_THRESHOLD}`,
        destination: destinationForType("high_foreign_tension"),
        fingerprint,
      },
      financialRisk: rel.tension,
      timeToConsequence: 0,
    });
  }

  // 6. no_active_construction — zero active projects + capacity + eligible design
  {
    const activeCount = nation.constructionProjects.filter((p) => p.status !== "COMPLETED").length;
    if (activeCount === 0 && treasury > 0 && shipyardCapacity > 0) {
      const hasEligibleDesign = [...snapshot.designs.values()].some(
        (d) => d.nationId === playerNationId,
      );
      if (hasEligibleDesign) {
        const fingerprint = "no_active_construction";
        ranked.push({
          priority: {
            id: fingerprint,
            type: "no_active_construction",
            severity: "advisory",
            title: "No active construction",
            summary: "No yards are building — authorize a design while funds and capacity allow.",
            reason: `no_active_construction: activeCount 0, treasury ${treasury} >0, shipyardCapacity ${shipyardCapacity} >0, hasEligibleDesign true`,
            destination: destinationForType("no_active_construction"),
            fingerprint,
          },
          financialRisk: 0,
          timeToConsequence: Number.POSITIVE_INFINITY / 2,
        });
      }
    }
  }

  // 5-key deterministic sort
  ranked.sort((a, b) => {
    // 1. Severity (critical first)
    const sevDiff = SEVERITY_RANK[b.priority.severity] - SEVERITY_RANK[a.priority.severity];
    if (sevDiff !== 0) return sevDiff;

    // 2. Direct financial risk — larger risk first
    if (a.financialRisk !== b.financialRisk) return b.financialRisk - a.financialRisk;

    // 3. Shortest time to consequence — shorter time first
    if (a.timeToConsequence !== b.timeToConsequence) {
      return a.timeToConsequence - b.timeToConsequence;
    }

    // 4. Stable type order
    const typeDiff = TYPE_ORDER[a.priority.type] - TYPE_ORDER[b.priority.type];
    if (typeDiff !== 0) return typeDiff;

    // 5. Stable fingerprint
    return a.priority.fingerprint.localeCompare(b.priority.fingerprint);
  });

  return ranked.map((r) => r.priority);
}
