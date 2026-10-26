import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import type {
  CampaignSnapshot,
  ResearchState,
  TechnologyDefinitionData,
  TechnologyProgress,
} from "./state.js";

export type TechnologyCatalogue = ReadonlyMap<string, TechnologyDefinitionData>;

export function technologyCatalogueOf(snapshot: CampaignSnapshot): TechnologyCatalogue {
  return new Map((snapshot["world"]["technologies"] ?? []).map((t) => [t["techId"], t] as const));
}

export interface EligibleTechnology extends TechnologyProgress {
  readonly discoveryWeight: SafeInt;
  readonly availabilityMonth: SafeInt;
}

export function eligibleTechnologiesForField(
  fieldId: string,
  techs: readonly TechnologyProgress[],
  discoveredTechs: readonly string[],
  turnNumber: SafeInt,
  catalogue: TechnologyCatalogue,
): EligibleTechnology[] {
  const completed = new Set(techs.filter((t) => t["completed"]).map((t) => t["techId"]));
  for (const id of discoveredTechs) completed.add(id);
  const progress = new Map(techs.map((t) => [t["techId"], t] as const));
  const eligible: EligibleTechnology[] = [];
  for (const def of catalogue.values()) {
    if (def["researchFieldId"] !== fieldId) continue;
    if (completed.has(def["techId"])) continue;
    if (!def["prerequisites"].every((prereqId) => completed.has(prereqId))) continue;
    if ((turnNumber as number) < (def["availabilityMonth"] as number)) continue;
    eligible.push({
      techId: def["techId"],
      investedPoints: progress.get(def["techId"])?.["investedPoints"] ?? SafeInt.ZERO,
      completed: false,
      discoveryWeight: def["discoveryWeight"],
      availabilityMonth: def["availabilityMonth"],
    });
  }
  return eligible;
}

export function eligibleResearchFields(
  research: ResearchState,
  turnNumber: SafeInt,
  catalogue: TechnologyCatalogue,
): [string, SafeInt][] {
  const fields: [string, SafeInt][] = [];
  for (const fieldId of CANONICAL_RESEARCH_FIELD_IDS) {
    const open = eligibleTechnologiesForField(
      fieldId,
      research["technologies"],
      research["discoveredTechs"],
      turnNumber,
      catalogue,
    );
    if (open.length === 0) continue;
    const priority = research["fieldPriorities"][fieldId] ?? SafeInt(1);
    if ((priority as number) <= 0) continue;
    fields.push([fieldId, priority]);
  }
  return fields;
}

const NEUTRAL_TIMING_BP = 10_000;

export function historicalTimingModifierBp(
  availabilityMonth: SafeInt | undefined,
  turnNumber: SafeInt,
): number {
  const monthsAfter = (turnNumber as number) - ((availabilityMonth ?? SafeInt(0)) as number);
  if (monthsAfter > 60) return 12_500;
  if (monthsAfter >= 0) return NEUTRAL_TIMING_BP;
  if (monthsAfter >= -24) return 8_000;
  if (monthsAfter >= -60) return 5_000;
  return NEUTRAL_TIMING_BP;
}

export function discoveryDrawWeight(
  baseWeight: SafeInt,
  availabilityMonth: SafeInt | undefined,
  turnNumber: SafeInt,
): SafeInt {
  const adjusted = SafeInt.div(
    SafeInt.mul(baseWeight, SafeInt(historicalTimingModifierBp(availabilityMonth, turnNumber))),
    SafeInt(10_000),
    "floor",
  );
  return (adjusted as number) < 1 ? SafeInt.ONE : adjusted;
}
