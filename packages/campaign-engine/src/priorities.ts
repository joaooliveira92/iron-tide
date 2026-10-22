import { Schema } from "effect";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { economyOutlook } from "@bluewave/campaign";
import { HIGH_TENSION_THRESHOLD, isHighTension } from "./diplomacy.js";
import { MIN_RESEARCH_SHARE_BP, NEAR_COMPLETION_WORK_RATIO } from "./priorityConstants.js";

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

interface RankedPriority {
  readonly priority: StrategicPriority;
  readonly financialRisk: number;
  readonly timeToConsequence: number;
}

const SEVERITY_RANK: Record<PrioritySeverity, number> = {
  critical: 3,
  warning: 2,
  advisory: 1,
  information: 0,
};

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

export function buildPrioritiesProjection(
  snapshot: CampaignSnapshot,
  playerNationId: string,
): readonly StrategicPriority[] {
  const nation = snapshot.nations.get(playerNationId);
  if (nation === undefined) return [];

  const ports = snapshot.world.ports.filter((p) => p.nationId === playerNationId);
  const shipyardCapacity = ports.reduce((sum, p) => sum + Number(p.level), 0);

  const outlook = economyOutlook(snapshot, playerNationId)!;
  const monthlyAppropriation = outlook.revenue;
  const researchSpend = outlook.plannedResearch;
  const fleetMaintenance = outlook.maintenance;
  const obligations = outlook.obligations;
  const projectedBalance = outlook.projectedNet;
  const totalMonthlyExpenditure = fleetMaintenance + obligations + researchSpend;
  const treasury = Number(nation.treasury);

  const ranked: RankedPriority[] = [];

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
        summary: `Projected balance ${projectedBalance} — expenditure exceeds naval appropriation.`,
        reason: `monthly_deficit: appropriation ${monthlyAppropriation} − obligations ${obligations} − maintenance ${fleetMaintenance} − research ${researchSpend} = ${projectedBalance}; treasury ${treasury} ${critical ? "insolvent" : "still solvent"}`,
        destination: destinationForType("monthly_deficit"),
        fingerprint,
      },
      financialRisk: Math.abs(projectedBalance),
      timeToConsequence: treasury < 0 ? 0 : Math.floor(treasury / Math.abs(projectedBalance)),
    });
  }

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
          summary: `Treasury ${treasury} below one month's expenditure ${threshold}.`,
          reason: `critical_cash_reserve: treasury ${treasury} < max(totalMonthlyExpenditure ${totalMonthlyExpenditure}, 1) = ${threshold}`,
          destination: destinationForType("critical_cash_reserve"),
          fingerprint,
        },
        financialRisk: Math.max(threshold - treasury, 0),
        timeToConsequence: 0,
      });
    }
  }

  if (monthlyAppropriation > 0) {
    if (researchSpend * 10_000 < monthlyAppropriation * MIN_RESEARCH_SHARE_BP) {
      const fingerprint = "low_research_spending";
      const expectedResearch = Math.floor((monthlyAppropriation * MIN_RESEARCH_SHARE_BP) / 10_000);
      ranked.push({
        priority: {
          id: fingerprint,
          type: "low_research_spending",
          severity: "warning",
          title: "Low research spending",
          summary: `Research ${researchSpend} is below ${MIN_RESEARCH_SHARE_BP / 100}% of naval appropriation ${monthlyAppropriation}.`,
          reason: `low_research_spending: researchSpend ${researchSpend} * 10_000 < monthlyAppropriation ${monthlyAppropriation} * ${MIN_RESEARCH_SHARE_BP}`,
          destination: destinationForType("low_research_spending"),
          fingerprint,
        },
        financialRisk: Math.max(expectedResearch - researchSpend, 0),
        timeToConsequence: Number.POSITIVE_INFINITY / 2,
      });
    }
  }

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
          summary: `Project ${project.id} is ${Math.floor((completed * 100) / total)}% complete — reallocate yards on completion.`,
          reason: `construction_near_completion: project ${project.id} completedWork ${completed} / totalWork ${total} >= ${NEAR_COMPLETION_WORK_RATIO}`,
          destination: destinationForType("construction_near_completion"),
          fingerprint,
        },
        financialRisk: Math.max(total - completed, 0),
        timeToConsequence: 1 - completed / total,
      });
    }
  }

  for (const rel of snapshot.politics.relations) {
    const isParty = rel.nationA === playerNationId || rel.nationB === playerNationId;
    if (!isParty) continue;
    if (!isHighTension(rel.tension)) continue;
    const partnerId = rel.nationA === playerNationId ? rel.nationB : rel.nationA;
    const fingerprint = `high_foreign_tension:${partnerId}`;
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

  ranked.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.priority.severity] - SEVERITY_RANK[a.priority.severity];
    if (sevDiff !== 0) return sevDiff;

    if (a.financialRisk !== b.financialRisk) return b.financialRisk - a.financialRisk;

    if (a.timeToConsequence !== b.timeToConsequence) {
      return a.timeToConsequence - b.timeToConsequence;
    }

    const typeDiff = TYPE_ORDER[a.priority.type] - TYPE_ORDER[b.priority.type];
    if (typeDiff !== 0) return typeDiff;

    return a.priority.fingerprint.localeCompare(b.priority.fingerprint);
  });

  return ranked.map((r) => r.priority);
}
