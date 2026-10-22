import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import type { ResearchScreenProjection } from "../../../shared/research-contract.js";

export type FieldWeightOption =
  | typeof RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH
  | typeof RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM
  | typeof RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;

export type FieldWeightsDraft = Readonly<Record<string, number>>;

export const WEIGHT_OPTIONS: readonly {
  readonly weight: FieldWeightOption;
  readonly label: string;
  readonly isHigh: boolean;
}[] = [
  { weight: RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH, label: "High", isHigh: true },
  { weight: RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM, label: "Med", isHigh: false },
  { weight: RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW, label: "Low", isHigh: false },
];

function isWeightValue(value: number | undefined): value is FieldWeightOption {
  return (
    value === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH ||
    value === RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM ||
    value === RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW
  );
}

export function seedDraft(projection: ResearchScreenProjection): FieldWeightsDraft {
  const draft: Record<string, number> = {};
  for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
    const weight = projection.fieldPriorities[field];
    draft[field] = isWeightValue(weight) ? weight : RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
  }
  return Object.freeze(draft);
}

export function setDraftWeight(
  draft: FieldWeightsDraft,
  fieldId: string,
  weight: FieldWeightOption,
): FieldWeightsDraft {
  if (
    weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH &&
    draft[fieldId] !== RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH
  ) {
    const currentHigh = CANONICAL_RESEARCH_FIELD_IDS.filter(
      (field) => draft[field] === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
    ).length;
    if (currentHigh >= MAX_HIGH_PRIORITY_FIELDS) return draft;
  }
  return Object.freeze({ ...draft, [fieldId]: weight });
}

export function draftToPriorities(draft: FieldWeightsDraft): Record<string, number> {
  const payload: Record<string, number> = {};
  for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
    payload[field] = draft[field] ?? RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
  }
  return payload;
}

export function draftHighCount(draft: FieldWeightsDraft): number {
  return CANONICAL_RESEARCH_FIELD_IDS.filter(
    (field) => draft[field] === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
  ).length;
}

export function draftIsSubmittable(draft: FieldWeightsDraft): boolean {
  const highCount = draftHighCount(draft);
  return (
    CANONICAL_RESEARCH_FIELD_IDS.every((field) => isWeightValue(draft[field])) &&
    highCount >= 1 &&
    highCount <= MAX_HIGH_PRIORITY_FIELDS
  );
}

export function isDraftDirty(
  projection: ResearchScreenProjection,
  draft: FieldWeightsDraft,
): boolean {
  for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
    const committed = projection.fieldPriorities[field] ?? RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
    const edited = draft[field] ?? RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
    if (committed !== edited) return true;
  }
  return false;
}
