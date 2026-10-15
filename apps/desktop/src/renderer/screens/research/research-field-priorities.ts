import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import type { ResearchScreenProjection } from "../../../shared/research-contract.js";

/** One canonical field's edit weight option for the picker. */
export type FieldWeightOption =
  | typeof RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH
  | typeof RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM
  | typeof RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;

export type FieldWeightsDraft = Readonly<Record<string, number>>;

/** The values the picker toggles between — the DESIGN-20 weight scale. */
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

/** Seed the editable draft from the projection: every canonical field present,
 * values clamped to the DESIGN-20 weight scale (anything else the compiler
 * emitted defaults to LOW — the picker's baseline, re-validated by the engine
 * on submit). */
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
  // INC-5: 5-HIGH cap — raising a 6th field to HIGH is rejected (no silent
  // redistribution). The caller must first lower another HIGH field.
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

/** The payload record for `setResearchPriorityCommand`, in canonical field
 * order (stable for idempotency comparison). */
export function draftToPriorities(draft: FieldWeightsDraft): Record<string, number> {
  const payload: Record<string, number> = {};
  for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
    payload[field] = draft[field] ?? RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
  }
  return payload;
}

/** How many fields are currently set to HIGH — the engine's command
 * validation requires 1..5 (MAX_HIGH_PRIORITY_FIELDS). */
export function draftHighCount(draft: FieldWeightsDraft): number {
  return CANONICAL_RESEARCH_FIELD_IDS.filter(
    (field) => draft[field] === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
  ).length;
}

/** A draft is submittable when every canonical field carries a weight from
 * the {1,2,4} scale and at least one field is HIGH (mirrors the engine's
 * `SetResearchPriority` lifecycle validation). The engine also requires
 * `highCount <= MAX_HIGH_PRIORITY_FIELDS` — the UI's 5-HIGH cap (spec §10,
 * INC-5). */
export function draftIsSubmittable(draft: FieldWeightsDraft): boolean {
  const highCount = draftHighCount(draft);
  return (
    CANONICAL_RESEARCH_FIELD_IDS.every((field) => isWeightValue(draft[field])) &&
    highCount >= 1 &&
    highCount <= MAX_HIGH_PRIORITY_FIELDS
  );
}

/** Whether the editable draft diverges from the last committed projection —
 * the renderer-only "unsaved changes" signal (spec §17). Only the research
 * allocation surface has a draft, so this is the one place the indicator is
 * meaningful. */
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
