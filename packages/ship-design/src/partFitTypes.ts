/**
 * The fit-validation contract (ship-part-model SPM-R12, ticket 06; ADR-0154 §16).
 *
 * A fit result separates three states a caller must never confuse:
 * - `ACCEPTED`: the loadout fits; nothing in `findings` or `dataIssues`;
 * - `REJECTED`: the data is well formed but a rule fails (`findings`, expected errors);
 * - `NOT_EVALUABLE`: required data is missing or malformed (`dataIssues`), so some rule
 *   could not be decided. Findings for the parts that could be evaluated are still listed.
 *
 * Codes are the contract; `message` only supplements them. Everything is codepoint-ordered
 * and independent of the input order.
 */

/** Finding codes in their contractual sort order (ticket 06; stage order is in `partFit.ts`). */
export const FIT_FINDING_CODES = [
  /** Stage 0 (ticket 11a): the platform's availability window excludes the design month. */
  "FIT_PLATFORM_NOT_YET_AVAILABLE",
  "FIT_PLATFORM_UNAVAILABLE",
  /** Stage 1: the entry (or a nested entry) names a slot the platform or part does not have. */
  "FIT_UNKNOWN_SLOT",
  "FIT_COUNT_EXCEEDED",
  /** A declared `mountCount.min` is not reached (the model declares a minimum; ticket 06 names no code). */
  "FIT_COUNT_BELOW_MINIMUM",
  "FIT_INTERFACE_MISMATCH",
  "FIT_CONSTRAINT_VIOLATED",
  "FIT_NOT_YET_AVAILABLE",
  "FIT_UNAVAILABLE",
  /** The part's `lifecycle.requires` names technologies the caller has not unlocked. */
  "FIT_TECHNOLOGY_LOCKED",
  "FIT_NATION_ACCESS",
  /**
   * Ship-type fit requirements (SPM-R12, ADR-0156 §4, ticket 12b): the intended type's
   * `classification.requires` are not met. Placed after `FIT_NATION_ACCESS` in the contractual
   * order, as SPM-R12 documents. Empty `requires` (every 1880 record) emits none of these.
   */
  "TYPE_REQUIRES_SLOT_MISSING",
  "TYPE_REQUIRES_INTERFACE_MISMATCH",
  "TYPE_REQUIRES_CONSTRAINT_VIOLATED",
  "TYPE_REQUIRES_MOUNT_COUNT",
  /** Stage 6: station or side outside the slot's declared placement. */
  "FIT_PLACEMENT",
] as const;
export type FitFindingCode = (typeof FIT_FINDING_CODES)[number];

/** Data-quality codes: the input cannot be evaluated, which is not a design rejection. */
export const FIT_DATA_ISSUE_CODES = [
  "FIT_DATA_UNKNOWN_PLATFORM",
  "FIT_DATA_UNKNOWN_TEMPLATE",
  "FIT_DATA_DUPLICATE_SLOT",
  "FIT_DATA_BAD_MIRROR",
  "FIT_DATA_DUPLICATE_PART",
  /** Two entries of one loadout share an `id` (ticket 11a). */
  "FIT_DATA_DUPLICATE_ENTRY_ID",
  /** An entry contains itself, directly or through nested entries (ticket 11a). */
  "FIT_DATA_ENTRY_CYCLE",
  "FIT_DATA_UNKNOWN_PART",
  "FIT_DATA_BAD_MONTH",
  "FIT_DATA_PARAMETER_MISSING",
  "FIT_DATA_PARAMETER_UNDECLARED",
  "FIT_DATA_SHAPE_MISSING",
  "FIT_DATA_SHAPE_UNEXPECTED",
  "FIT_DATA_CONSTRAINT_UNEVALUABLE",
] as const;
export type FitDataIssueCode = (typeof FIT_DATA_ISSUE_CODES)[number];

/** Structured evidence; values are scalars or id lists so the result is plain data. */
export type FitDetail = Readonly<
  Record<string, string | number | boolean | null | readonly (string | number)[]>
>;

export interface FitFinding {
  readonly code: FitFindingCode;
  /** Stable, order-independent address: `entries/<slot>/<part>#<n>[/entries/<slot>/<part>#<n>]…`. */
  readonly path: string;
  readonly slot: string;
  /** The part the finding is about, when there is one. */
  readonly part: string | null;
  readonly detail: FitDetail;
  readonly message: string;
}

export interface FitDataIssue {
  readonly code: FitDataIssueCode;
  readonly path: string;
  readonly detail: FitDetail;
  readonly message: string;
}

/** A `DQ-TORPEDO-001` waiver that permitted exactly one named mismatch (ADVISORY, never an error). */
export interface FitAppliedWaiver {
  readonly path: string;
  readonly launcher: string;
  readonly torpedo: string;
  readonly code: string;
  readonly waives: string;
  readonly boreDiameterUm: number;
  readonly torpedoDiameterUm: number;
}

/**
 * A relationship the model cannot resolve uniquely. It is reported and never guessed: a
 * magazine is chosen by nothing in an entry but `feedsFrom` (a slot, not a magazine), and
 * one zone may hold two magazines (tickets 08 and 11 own the missing data).
 */
export interface FitUnresolvedRelationship {
  readonly code: "FIT_MAGAZINE_AMBIGUOUS" | "FIT_MAGAZINE_UNDETERMINED";
  readonly path: string;
  /** Magazine entry paths that could feed it, codepoint-ordered. */
  readonly candidates: readonly string[];
  readonly message: string;
}

export type FitStatus = "ACCEPTED" | "REJECTED" | "NOT_EVALUABLE";

export interface FitResult {
  readonly status: FitStatus;
  readonly platform: string;
  readonly month: string;
  readonly findings: readonly FitFinding[];
  readonly dataIssues: readonly FitDataIssue[];
  readonly waivers: readonly FitAppliedWaiver[];
  readonly unresolved: readonly FitUnresolvedRelationship[];
}

/**
 * The national side input (ADR-0089: a national limit narrows and never widens). The part
 * model carries a part's `nation`; the hard caps live in the nation's naval profile, so they
 * arrive as typed data rather than being read from the profile here.
 */
export interface FitNationInput {
  readonly nationId: string;
  /** Parts the nation may not use at all (its component access is denied). */
  readonly deniedParts?: readonly string[];
  /** The nation's hard gun-calibre cap in micrometres. */
  readonly maxGunCalibreUm?: number;
}

/**
 * Which guns an ammunition part may feed. Legacy selection facts (`compatibleGunFamilies`,
 * `compatibleGunModelIds`) have no field on the part, so the caller supplies the resolved
 * gun part ids. An ammunition part with no entry is unconstrained.
 */
export type FitAmmunitionCompatibility = Readonly<Record<string, readonly string[]>>;

/** A legal count range in the shape of a part parameter: inclusive bounds and a step. */
export type FitMountCountRanges = Readonly<
  Record<string, { readonly min: number; readonly max: number; readonly step: number }>
>;
