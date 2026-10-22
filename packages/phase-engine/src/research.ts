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
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
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

export function resolveResearchNations(
  nations: CampaignSnapshot["nations"],
  catalogue: TechnologyCatalogue,
  randomEngine: RandomEngine,
  turnNumber: SafeInt,
  randomLedger: RandomLedger,
  eventLedger: EventLedger,
  financialLedger: FinancialLedger,
  collector: DiagnosticCollector,
  nextSeq: () => SafeInt,
  campaignMonth: string,
): CampaignSnapshot["nations"] {
  let nextNations: Map<string, NationState> | null = null;

  for (const [nationId, nation] of nations) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    const research = nation["research"];

    const techs = research["technologies"];
    const eligibleFields = eligibleResearchFields(research, turnNumber, catalogue);
    if ((research["researchBudget"] as number) > 0 && eligibleFields.length === 0) {
      collector.addInfo(
        "NO_ELIGIBLE_RESEARCH_FIELD",
        `Nation ${nationId} has no eligible research field; its standing research budget of ${String(research["researchBudget"])} is not drawn`,
        { stage: "resolve_research", entityId: nationId },
      );
      continue;
    }

    const settlement = settleOutflow(research["researchBudget"], nation["treasury"]);
    reportOutflowShortfall(collector, nationId, "research", settlement, "resolve_research");
    const actualPaidExpenditure = settlement.paid;
    const effectiveResources = computeResearchResources(actualPaidExpenditure);

    if ((effectiveResources as number) <= 0) {
      if ((settlement.shortfall as number) > 0)
        financialLedger.append(
          makeLedgerEntry(
            nationId,
            "resolve_research",
            "RESEARCH_EXPENDITURE",
            actualPaidExpenditure,
            actualPaidExpenditure,
            nation["treasury"],
            nation["treasury"],
            "Research budget expenditure",
            campaignMonth,
            settlement,
          ),
        );
      continue;
    }

    const fieldAllocations = largestRemainderAllocation(effectiveResources, eligibleFields);

    const activeCandidates = new Map(research["activeCandidates"]);
    const updatedTechs = [...techs];
    const monthDiscoveredTechs = new Set(research["discoveredTechs"]);

    for (const [fieldId, allocation] of fieldAllocations) {
      if ((allocation as number) <= 0) continue;

      let activeTechId = activeCandidates.get(fieldId);

      if (!activeTechId) {
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

        const stream = randomEngine.stream(`research/month/${nationId}/${fieldId}`);
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

      let techIdx = updatedTechs.findIndex((t) => t["techId"] === activeTechId);
      if (techIdx < 0) {
        updatedTechs.push({ techId: activeTechId, investedPoints: SafeInt.ZERO, completed: false });
        techIdx = updatedTechs.length - 1;
      }

      const tech = updatedTechs[techIdx]!;
      const newPoints = SafeInt.add(tech["investedPoints"], allocation);
      updatedTechs[techIdx] = { ...tech, investedPoints: newPoints };

      const cost = findTechCost(catalogue, activeTechId);
      const clampedPoints = (newPoints as number) > (cost as number) ? cost : newPoints;
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

      if ((clampedPoints as number) >= (cost as number)) {
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

        updatedTechs[techIdx] = {
          ...updatedTechs[techIdx]!,
          completed: true,
          investedPoints: cost,
        };
        monthDiscoveredTechs.add(activeTechId);

        activeCandidates.delete(fieldId);

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

    nextNations ??= new Map(nations);
    nextNations.set(nationId, updatedNation);

    const previousBalance = nation["treasury"];
    const newBalance = SafeInt.sub(previousBalance, actualPaidExpenditure);
    const safeNewBalance = newBalance < SafeInt.ZERO ? SafeInt.ZERO : newBalance;

    const updatedTreasuryNation: NationState = {
      ...updatedNation,
      treasury: safeNewBalance,
    };
    nextNations.set(nationId, updatedTreasuryNation);

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

  return nextNations ?? nations;
}

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
  return catalogue.get(techId)!["cost"];
}

export function researchCostLookup(
  snapshot: CampaignSnapshot,
): (techId: string) => number | undefined {
  const catalogue = technologyCatalogueOf(snapshot);
  return (techId) => {
    const def = catalogue.get(techId);
    return def === undefined ? undefined : (def["cost"] as number);
  };
}

export function runResearchPhase(ctx: PhaseContext): PhaseRunOutcome {
  const nations = ctx.snapshot.read("nations");
  const catalogue = technologyCatalogueOf(ctx.snapshot.current);
  const next = resolveResearchNations(
    nations,
    catalogue,
    ctx.rng.engine(),
    ctx.turnNumber,
    ctx.randomLedger,
    ctx.eventLedger,
    ctx.financialLedger,
    ctx.collector,
    ctx.nextSeq,
    ctx.campaignMonth,
  );
  if (next !== nations) ctx.snapshot.write("nations", next);
  return { status: "continue" };
}

export const researchPhase: MonthPhase = {
  id: "resolve_research",
  name: "Research Resolution",
  permissions: { reads: ["nations", "world"], writes: ["nations"], rng: true },
  run: runResearchPhase,
};
