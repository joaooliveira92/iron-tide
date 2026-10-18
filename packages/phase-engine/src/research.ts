import {
  eligibleResearchFields,
  eligibleTechnologiesForField,
  settleOutflow,
  technologyCatalogueOf,
  type CampaignSnapshot,
  type NationState,
  type TechnologyCatalogue,
} from "@bluewave/campaign";
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
  const catalogue = technologyCatalogueOf(snapshot);

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
    const techs = research["technologies"];
    const eligibleFields = eligibleResearchFields(research, turnNumber, catalogue);

    if (eligibleFields.length === 0) {
      collector.addInfo(
        "NO_ELIGIBLE_RESEARCH_FIELD",
        `Nation ${nationId} has no eligible research field; its standing research budget of ${String(actualPaidExpenditure)} is not drawn`,
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
        const fieldTechs = eligibleTechnologiesForField(
          fieldId,
          updatedTechs,
          [...monthDiscoveredTechs],
          turnNumber,
          catalogue,
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
      let techIdx = updatedTechs.findIndex((t) => t["techId"] === activeTechId);
      if (techIdx < 0) {
        // A catalogue technology no one has started yet gains its progress row on first funding.
        updatedTechs.push({ techId: activeTechId, investedPoints: SafeInt.ZERO, completed: false });
        techIdx = updatedTechs.length - 1;
      }

      const tech = updatedTechs[techIdx]!;
      const newPoints = SafeInt.add(tech["investedPoints"], allocation);
      updatedTechs[techIdx] = { ...tech, investedPoints: newPoints };

      // Calculate progress beyond cost
      const cost = findTechCost(catalogue, activeTechId);
      const clampedPoints = (newPoints as number) > (cost as number) ? cost : newPoints;
      // Points beyond what the technology still needs were paid for but cannot be applied: reported, never silent.
      if ((newPoints as number) > (cost as number))
        collector.addWarning(
          "RESEARCH_UNSPENT",
          `Nation ${nationId} paid ${String((newPoints as number) - (cost as number))} research points beyond the cost of ${activeTechId}`,
          { stage: "resolve_research", entityId: nationId },
        );
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
        const revalidated = eligibleTechnologiesForField(
          fieldId,
          updatedTechs,
          [...monthDiscoveredTechs],
          turnNumber,
          catalogue,
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

function findTechCost(catalogue: TechnologyCatalogue, techId: string): SafeInt {
  return catalogue.get(techId)?.["cost"] ?? SafeInt(100);
}

/**
 * The research model's authoritative cost for a technology id, read from the snapshot's compiled catalogue, or
 * `undefined` when the catalogue carries none. Foreign insight reads this only to cap an award at the technology's
 * remaining requirement and never fabricates a cost it does not know: an unknown cost applies no per-technology cap
 * (the family cap still holds).
 */
export function researchCostLookup(
  snapshot: CampaignSnapshot,
): (techId: string) => number | undefined {
  const catalogue = technologyCatalogueOf(snapshot);
  return (techId) => {
    const def = catalogue.get(techId);
    return def === undefined ? undefined : (def["cost"] as number);
  };
}
