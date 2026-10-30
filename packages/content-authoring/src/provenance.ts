import { Data } from "effect";

export const PROVENANCE_STATUSES = [
  "sourced",
  "derived",
  "estimate",
  "balance_target",
  "placeholder",
] as const;

export type ProvenanceStatus = (typeof PROVENANCE_STATUSES)[number];

export interface Provenance {
  readonly status: ProvenanceStatus;
  readonly rationale?: string;
  readonly source?: string;
}

export class ProvenanceError extends Data.TaggedError("ProvenanceError")<{
  readonly field: string;
  readonly message: string;
}> {}

const isNonEmpty = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== "";

const RATIONALE_REQUIRED: ReadonlySet<ProvenanceStatus> = new Set([
  "derived",
  "estimate",
  "placeholder",
]);

export const provenance = (field: string, value: Provenance): Provenance => {
  if (value.status === "sourced" && !isNonEmpty(value.source)) {
    throw new ProvenanceError({
      field,
      message: "a sourced value must name its source, not only a confidence",
    });
  }
  if (RATIONALE_REQUIRED.has(value.status) && !isNonEmpty(value.rationale)) {
    throw new ProvenanceError({
      field,
      message: `${value.status} must explain itself in rationale so the value stays reviewable`,
    });
  }
  return Object.freeze(value);
};

export const requiresRationale = (status: ProvenanceStatus): boolean =>
  RATIONALE_REQUIRED.has(status);
