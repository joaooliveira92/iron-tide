export const FIT_FINDING_CODES = [
  "FIT_PLATFORM_NOT_YET_AVAILABLE",
  "FIT_PLATFORM_UNAVAILABLE",
  "FIT_UNKNOWN_SLOT",
  "FIT_COUNT_EXCEEDED",
  "FIT_COUNT_BELOW_MINIMUM",
  "FIT_INTERFACE_MISMATCH",
  "FIT_CONSTRAINT_VIOLATED",
  "FIT_NOT_YET_AVAILABLE",
  "FIT_UNAVAILABLE",
  "FIT_TECHNOLOGY_LOCKED",
  "FIT_NATION_ACCESS",
  "TYPE_REQUIRES_SLOT_MISSING",
  "TYPE_REQUIRES_INTERFACE_MISMATCH",
  "TYPE_REQUIRES_CONSTRAINT_VIOLATED",
  "TYPE_REQUIRES_MOUNT_COUNT",
  "FIT_PLACEMENT",
] as const;
export type FitFindingCode = (typeof FIT_FINDING_CODES)[number];

export const FIT_DATA_ISSUE_CODES = [
  "FIT_DATA_UNKNOWN_PLATFORM",
  "FIT_DATA_UNKNOWN_TEMPLATE",
  "FIT_DATA_DUPLICATE_SLOT",
  "FIT_DATA_BAD_MIRROR",
  "FIT_DATA_DUPLICATE_PART",
  "FIT_DATA_DUPLICATE_ENTRY_ID",
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

export type FitDetail = Readonly<
  Record<string, string | number | boolean | null | readonly (string | number)[]>
>;

export interface FitFinding {
  readonly code: FitFindingCode;
  readonly path: string;
  readonly slot: string;
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

export interface FitAppliedWaiver {
  readonly path: string;
  readonly launcher: string;
  readonly torpedo: string;
  readonly code: string;
  readonly waives: string;
  readonly boreDiameterUm: number;
  readonly torpedoDiameterUm: number;
}

export interface FitUnresolvedRelationship {
  readonly code: "FIT_MAGAZINE_AMBIGUOUS" | "FIT_MAGAZINE_UNDETERMINED";
  readonly path: string;
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

export interface FitNationInput {
  readonly nationId: string;
  readonly deniedParts?: readonly string[];
  readonly maxGunCalibreUm?: number;
}

export type FitAmmunitionCompatibility = Readonly<Record<string, readonly string[]>>;

export type FitMountCountRanges = Readonly<
  Record<string, { readonly min: number; readonly max: number; readonly step: number }>
>;
