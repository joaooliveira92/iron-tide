import {
  settleOutflow,
  type CampaignSnapshot,
  type NationState,
  type TechnologyProgress,
} from "@bluewave/campaign";
import { CANONICAL_RESEARCH_FIELD_IDS as RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import type { FinancialLedger } from "./financial-ledger.js";
import { reportOutflowShortfall } from "./outflowShortfall.js";
import {
  budgetChangedEvent,
  CURRENT_VERSION,
  makeLedgerEntry,
  researchProgressedEvent,
} from "./events.js";

const RESEARCH_RESOURCE_CONVERSION_BP = SafeInt(10_000);
const CANONICAL_FIELD_IDS = RESEARCH_FIELD_IDS;

function drawWeighted(
  stream: import("@bluewave/random").RandomStream,
  weights: [string, SafeInt][],
): string {
  const totalWeight = weights.reduce((sum, [, w]) => SafeInt.add(sum, w), SafeInt.ZERO);
  if ((totalWeight as number) <= 0) return weights[0]?.[0] ?? "";
  const draw = stream.next() * (totalWeight as number);
  let cumulative = 0;
  for (const [id, weight] of weights) {
    cumulative += weight as number;
    if (draw <= cumulative) return id;
  }
  return weights[weights.length - 1]?.[0] ?? "";
}

function computeResearchResources(actualPaidExpenditure: SafeInt): SafeInt {
  if ((actualPaidExpenditure as number) <= 0) return SafeInt.ZERO;
  return SafeInt.div(
    SafeInt.mul(actualPaidExpenditure, RESEARCH_RESOURCE_CONVERSION_BP),
    SafeInt(10_000),
    "floor",
  );
}

function largestRemainderAllocation(
  resources: SafeInt,
  weights: [string, SafeInt][],
): Map<string, SafeInt> {
  const allocation = new Map<string, SafeInt>();
  if ((resources as number) <= 0 || weights.length === 0) return allocation;

  const totalWeight = weights.reduce((sum, [, w]) => SafeInt.add(sum, w), SafeInt.ZERO);
  if ((totalWeight as number) <= 0) return allocation;

  // Proportional allocation with floor
  let allocated = SafeInt.ZERO;
  const remainders: [string, number][] = [];

  for (const [fieldId, weight] of weights) {
    const rawProportion = (weight as number) / (totalWeight as number);
    const floorShare = SafeInt(Math.floor(rawProportion * (resources as number)));
    allocation.set(fieldId, floorShare);
    allocated = SafeInt.add(allocated, floorShare);
    const remainder = rawProportion * (resources as number) - (floorShare as number);
    remainders.push([fieldId, remainder]);
  }

  // Distribute remaining by largest remainder
  let remaining = SafeInt.sub(resources, allocated);
  remainders.sort((a, b) => b[1] - a[1]);

  for (const [fieldId] of remainders) {
    if ((remaining as number) <= 0) break;
    const current = allocation.get(fieldId) ?? SafeInt.ZERO;
    allocation.set(fieldId, SafeInt.add(current, SafeInt.ONE));
    remaining = SafeInt.sub(remaining, SafeInt.ONE);
  }

  return allocation;
}

export function resolveResearchPhase(
  snapshot: CampaignSnapshot,
  randomSeed: string,
  turnNumber: SafeInt,
  randomLedger: RandomLedger,
  eventLedger: EventLedger,
  financialLedger: FinancialLedger,
  collector: DiagnosticCollector,
  nextSeq: () => SafeInt,
  campaignMonth: string,
): CampaignSnapshot {
  let currentSnapshot = snapshot;

  for (const [nationId, nation] of currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    const research = nation["research"];

    // Stage 1: Calculate paid research resources
    const settlement = settleOutflow(research["researchBudget"], nation["treasury"]);
    reportOutflowShortfall(collector, nationId, "research", settlement, "resolve_research");
    const actualPaidExpenditure = settlement.paid;
    const effectiveResources = computeResearchResources(actualPaidExpenditure);

    if ((effectiveResources as number) <= 0) continue;

    // Stage 2: Allocate by field priority
    const priorities = research["fieldPriorities"];
    const eligibleFields: [string, SafeInt][] = [];

    const techs = research["technologies"];
    const discoveredTechs = research["discoveredTechs"];

    for (const fieldId of CANONICAL_FIELD_IDS) {
      // Find eligible tech for this field
      const eligibleTech = findEligibleTech(fieldId, techs, discoveredTechs, turnNumber);
      if (!eligibleTech) continue;

      const priority = priorities[fieldId] ?? SafeInt(1);
      if ((priority as number) <= 0) continue;

      eligibleFields.push([fieldId, priority]);
    }

    if (eligibleFields.length === 0) {
      collector.addWarning(
        "RESEARCH_UNSPENT",
        `Nation ${nationId} has no eligible research fields; ${String(actualPaidExpenditure)} of research is unspent`,
        { stage: "resolve_research", entityId: nationId },
      );
      continue;
    }

    const fieldAllocations = largestRemainderAllocation(effectiveResources, eligibleFields);

    // Stage 3: Advance eligible technologies
    const activeCandidates = new Map(research["activeCandidates"]);
    const updatedTechs = [...techs];
    const monthDiscoveredTechs = new Set(research["discoveredTechs"]);

    for (const [fieldId, allocation] of fieldAllocations) {
      if ((allocation as number) <= 0) continue;

      let activeTechId = activeCandidates.get(fieldId);

      if (!activeTechId) {
        // Select eligible technology with highest discovery weight
        const fieldTechs = findEligibleTechsForField(
          fieldId,
          updatedTechs,
          [...monthDiscoveredTechs],
          turnNumber,
        );
        if (fieldTechs.length === 0) {
          collector.addInfo(
            "NO_ELIGIBLE_TECHNOLOGY",
            `Nation ${nationId} field ${fieldId} has no eligible technology`,
            { stage: "resolve_research" },
          );
          continue;
        }

        // Deterministic weighted selection keyed by research/month/{nation}/{field}
        const stream = new RandomEngine(randomSeed).stream(`research/month/${nationId}/${fieldId}`);
        const weights: [string, SafeInt][] = fieldTechs.map(
          (t) =>
            [
              t.techId,
              applyHistoricalTimingModifier(
                t.discoveryWeight ?? SafeInt(1),
                t.availabilityMonth,
                turnNumber,
              ),
            ] as [string, SafeInt],
        );

        // Record this selection in the random ledger
        const inputHash = sha256Hex(
          canonicalSerialize({
            nationId,
            fieldId,
            turnNumber,
            eligibleTechs: fieldTechs.map((t) => t.techId),
          }),
        );

        activeTechId = drawWeighted(stream, weights);

        randomLedger.record({
          streamId: `research/month/${nationId}/${fieldId}`,
          entityKey: `${nationId}:${fieldId}`,
          phase: "resolve_research",
          rulesetVersion: CURRENT_VERSION,
          inputHash,
          draw: 0,
          outcome: `selected_tech_${activeTechId}`,
          reasonCode: "RESEARCH_SELECT_CANDIDATE",
        });

        activeCandidates.set(fieldId, activeTechId);
      }

      // Stage 4: Add progress to active candidate
      const techIdx = updatedTechs.findIndex((t) => t["techId"] === activeTechId);
      if (techIdx < 0) continue;

      const tech = updatedTechs[techIdx]!;
      const newPoints = SafeInt.add(tech["investedPoints"], allocation);
      updatedTechs[techIdx] = { ...tech, investedPoints: newPoints };

      // Calculate progress beyond cost
      const cost = findTechCost(activeTechId);
      const clampedPoints = (newPoints as number) > (cost as number) ? cost : newPoints;
      updatedTechs[techIdx] = { ...updatedTechs[techIdx]!, investedPoints: clampedPoints };

      eventLedger.append(
        researchProgressedEvent(
          nationId,
          activeTechId,
          tech["investedPoints"],
          clampedPoints,
          nextSeq(),
          campaignMonth,
        ),
      );

      // Stage 5: Check if discovered
      if ((clampedPoints as number) >= (cost as number)) {
        // Stage 7: revalidate prerequisites and availability before discovery.
        const revalidated = findEligibleTechsForField(
          fieldId,
          updatedTechs,
          [...monthDiscoveredTechs],
          turnNumber,
        ).some((t) => t.techId === activeTechId);
        if (!revalidated) {
          collector.addError(
            "TECHNOLOGY_DISCOVERY_VALIDATION_FAILED",
            `Discovery validation failed for ${activeTechId} (nation ${nationId})`,
            { stage: "resolve_research" },
          );
          continue;
        }

        // Mark as completed
        updatedTechs[techIdx] = {
          ...updatedTechs[techIdx]!,
          completed: true,
          investedPoints: cost,
        };
        monthDiscoveredTechs.add(activeTechId);

        // Remove from active candidates
        activeCandidates.delete(fieldId);

        // Apply IMMEDIATE_KNOWLEDGE effects (only immediate-knowledge effects
        // for B10b; adoption/production/refit branches are deferred).
        eventLedger.append({
          eventId: `TechnologyDiscovered-${nationId}-${activeTechId}-${String(nextSeq())}`,
          version: CURRENT_VERSION,
          aggregateType: "research" as const,
          aggregateId: activeTechId,
          eventType: "TechnologyDiscovered" as const,
          timestamp: `${campaignMonth}-01T00:00:00.000Z`,
          body: {
            kind: "TechnologyDiscovered" as const,
            nationId,
            techId: activeTechId,
            researchFieldId: fieldId,
            discoveryMonth: campaignMonth,
            cost,
          },
          sequenceNumber: nextSeq(),
        });
      }
    }

    const updatedNation: NationState = {
      ...nation,
      research: {
        ...research,
        technologies: updatedTechs,
        activeCandidates,
        discoveredTechs: [...monthDiscoveredTechs],
        researchBudget: research["standingResearchBudget"] ?? SafeInt.ZERO,
      },
    };

    const updatedNations = new Map(currentSnapshot["nations"]);
    updatedNations.set(nationId, updatedNation);
    currentSnapshot = { ...currentSnapshot, nations: updatedNations };

    // Record financial expenditure
    const previousBalance = nation["treasury"];
    const newBalance = SafeInt.sub(previousBalance, actualPaidExpenditure);
    const safeNewBalance = newBalance < SafeInt.ZERO ? SafeInt.ZERO : newBalance;

    const updatedTreasuryNation: NationState = {
      ...updatedNation,
      treasury: safeNewBalance,
    };
    const updatedTreasuryNations = new Map(currentSnapshot["nations"]);
    updatedTreasuryNations.set(nationId, updatedTreasuryNation);
    currentSnapshot = { ...currentSnapshot, nations: updatedTreasuryNations };

    financialLedger.append(
      makeLedgerEntry(
        nationId,
        "resolve_research",
        "RESEARCH_EXPENDITURE",
        actualPaidExpenditure,
        actualPaidExpenditure,
        previousBalance,
        safeNewBalance,
        "Research budget expenditure",
        campaignMonth,
        settlement,
      ),
    );

    if ((actualPaidExpenditure as number) > 0) {
      eventLedger.append(
        budgetChangedEvent(
          nationId,
          previousBalance,
          safeNewBalance,
          SafeInt.mul(actualPaidExpenditure, SafeInt(-1)),
          "Research budget expenditure",
          nextSeq(),
          campaignMonth,
        ),
      );
    }
  }

  return currentSnapshot;
}

/**
 * DESIGN-20 §12.2 historical timing modifier. The modifier is applied to a
 * candidate's base discovery weight based on how far the current month is from
 * the technology's canonical historical availability. The final campaign
 * availability month (availabilityMonth) remains a hard eligibility boundary
 * enforced in findEligibleTechsForField; the modifier only distinguishes by
 * how many months past availability a technology is.
 *
 * Shipped basis points: 5_000 (25-60 months before), 8_000 (1-24 months
 * before), 10_000 (canonical through 60 months after), 12_500 (60+ months
 * after). Months before availability are ineligible in this codebase
 * (availabilityMonth is treated as the hard boundary), so pre-availability
 * bands are expressed dutyfully but are unreachable.
 */
function applyHistoricalTimingModifier(
  baseWeight: SafeInt,
  availabilityMonth: SafeInt | undefined,
  turnNumber: SafeInt,
): SafeInt {
  const monthId = turnNumber as number;
  const availabilityDate = (availabilityMonth ?? SafeInt(0)) as number;
  const monthsAfter = monthId - availabilityDate;

  let modifierBp = SafeInt(10_000);
  if (monthsAfter > 60) {
    modifierBp = SafeInt(12_500);
  } else if (monthsAfter >= 0) {
    modifierBp = SafeInt(10_000);
  } else if (monthsAfter >= -24) {
    modifierBp = SafeInt(8_000);
  } else if (monthsAfter >= -60) {
    modifierBp = SafeInt(5_000);
  }

  const adjusted = SafeInt.div(SafeInt.mul(baseWeight, modifierBp), SafeInt(10_000), "floor");
  return (adjusted as number) < 1 ? SafeInt.ONE : adjusted;
}

function findEligibleTech(
  fieldId: string,
  techs: TechnologyProgress[],
  discoveredTechs: string[],
  turnNumber: SafeInt,
): TechnologyProgress | undefined {
  return findEligibleTechsForField(fieldId, techs, discoveredTechs, turnNumber)[0] ?? undefined;
}

function findEligibleTechsForField(
  fieldId: string,
  techs: TechnologyProgress[],
  discoveredTechs: string[],
  turnNumber: SafeInt,
): (TechnologyProgress & { discoveryWeight: SafeInt; availabilityMonth?: SafeInt })[] {
  const allDiscovered = new Set(discoveredTechs);
  return techs
    .filter((t) => {
      const def = TECH_DEFINITIONS[t["techId"]];
      if (!def) return false;
      if (def["researchFieldId"] !== fieldId) return false;
      if (t["completed"] || allDiscovered.has(t["techId"])) return false;
      // Check if not already discovered
      // Check prerequisites
      const prereqs = def["prerequisites"] ?? [];
      for (const prereqId of prereqs) {
        const prereqTech = techs.find((pt) => pt["techId"] === prereqId);
        if (!prereqTech || !prereqTech["completed"]) return false;
      }
      // Check availability month
      if (
        def["availabilityMonth"] !== undefined &&
        (turnNumber as number) < (def["availabilityMonth"] as number)
      ) {
        return false;
      }
      return true;
    })
    .map((t) => {
      const def = TECH_DEFINITIONS[t["techId"]]!;
      return {
        ...t,
        discoveryWeight: def["discoveryWeight"],
        availabilityMonth: def["availabilityMonth"],
      };
    });
}

interface TechDefinition {
  techId: string;
  researchFieldId: string;
  cost: SafeInt;
  discoveryWeight: SafeInt;
  prerequisites: string[];
  availabilityMonth?: SafeInt;
}

const TECH_DEFINITIONS: Record<string, TechDefinition> = {
  basic_hull: {
    techId: "basic_hull",
    researchFieldId: "HULL_CONSTRUCTION",
    cost: SafeInt(100),
    discoveryWeight: SafeInt(10),
    prerequisites: [],
    availabilityMonth: SafeInt(0),
  },
  advanced_hull: {
    techId: "advanced_hull",
    researchFieldId: "HULL_CONSTRUCTION",
    cost: SafeInt(200),
    discoveryWeight: SafeInt(8),
    prerequisites: ["basic_hull"],
    availabilityMonth: SafeInt(0),
  },
  basic_steam: {
    techId: "basic_steam",
    researchFieldId: "MACHINERY",
    cost: SafeInt(100),
    discoveryWeight: SafeInt(10),
    prerequisites: [],
    availabilityMonth: SafeInt(0),
  },
  advanced_steam: {
    techId: "advanced_steam",
    researchFieldId: "MACHINERY",
    cost: SafeInt(200),
    discoveryWeight: SafeInt(8),
    prerequisites: ["basic_steam"],
    availabilityMonth: SafeInt(0),
  },
  basic_gunnery: {
    techId: "basic_gunnery",
    researchFieldId: "GUNNERY",
    cost: SafeInt(100),
    discoveryWeight: SafeInt(10),
    prerequisites: [],
    availabilityMonth: SafeInt(0),
  },
  advanced_gunnery: {
    techId: "advanced_gunnery",
    researchFieldId: "GUNNERY",
    cost: SafeInt(200),
    discoveryWeight: SafeInt(8),
    prerequisites: ["basic_gunnery"],
    availabilityMonth: SafeInt(0),
  },
};

function findTechCost(techId: string): SafeInt {
  return TECH_DEFINITIONS[techId]?.["cost"] ?? SafeInt(100);
}

/**
 * The research model's authoritative cost for a technology id, or `undefined` when the model carries none. The
 * engine's cost table is the stub `TECH_DEFINITIONS` today (real content technologies are not materialised into
 * it). Foreign insight reads this only to cap an award at the technology's remaining requirement and never
 * fabricates a cost it does not know: an unknown cost applies no per-technology cap (the family cap still holds).
 */
export function researchCostOf(techId: string): number | undefined {
  const def = TECH_DEFINITIONS[techId];
  return def === undefined ? undefined : (def["cost"] as number);
}
