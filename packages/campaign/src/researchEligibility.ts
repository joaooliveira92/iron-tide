// Research eligibility (spec #138 slice 3): which technologies and fields can take research this month. The research phase
// funds only eligible fields and every projection reports unfunded research from this same rule, so the two cannot drift.
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import type {
  CampaignSnapshot,
  ResearchState,
  TechnologyDefinitionData,
  TechnologyProgress,
} from "./state.js";

/** The compiled research catalogue by technology id. */
export type TechnologyCatalogue = ReadonlyMap<string, TechnologyDefinitionData>;

export function technologyCatalogueOf(snapshot: CampaignSnapshot): TechnologyCatalogue {
  return new Map((snapshot["world"]["technologies"] ?? []).map((t) => [t["techId"], t] as const));
}

export interface EligibleTechnology extends TechnologyProgress {
  readonly discoveryWeight: SafeInt;
  readonly availabilityMonth: SafeInt;
}

/**
 * The technologies of `fieldId` open to research: not yet discovered, every prerequisite discovered, and available by
 * `turnNumber`. A technology no nation has started carries zero invested points. Catalogue order is canonical (sorted by id at
 * compile time), so the result order is deterministic.
 */
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

/** The fields that can take research this month, with their priority weight (a priority of 0 switches a field off). */
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
