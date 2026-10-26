import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import type { FieldWeightsDraft } from "./research-field-priorities.js";

export function deriveProjectedResearchAllocations(
  researchBudget: number,
  draft: FieldWeightsDraft,
  eligibleFieldIds: ReadonlySet<string>,
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
    result[field] = 0;
  }
  if (!Number.isSafeInteger(researchBudget) || researchBudget <= 0) return Object.freeze(result);

  const weights: [string, number][] = [];
  for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
    if (!eligibleFieldIds.has(field)) continue;
    const weight = draft[field];
    if (
      weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH ||
      weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM ||
      weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW
    ) {
      if (weight > 0) weights.push([field, weight]);
    }
  }
  if (weights.length === 0) return Object.freeze(result);

  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return Object.freeze(result);

  let allocated = 0;
  const remainders: [string, number][] = [];
  for (const [fieldId, weight] of weights) {
    const raw = (weight / totalWeight) * researchBudget;
    const floorShare = Math.floor(raw);
    result[fieldId] = floorShare;
    allocated += floorShare;
    remainders.push([fieldId, raw - floorShare]);
  }
  let remaining = researchBudget - allocated;
  remainders.sort((a, b) => b[1] - a[1]);
  for (const [fieldId] of remainders) {
    if (remaining <= 0) break;
    result[fieldId] = (result[fieldId] ?? 0) + 1;
    remaining -= 1;
  }
  return Object.freeze(result);
}
