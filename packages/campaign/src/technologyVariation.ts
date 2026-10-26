import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { displayValue, issueKeys, recordOf } from "./schemaIssueKeys.js";

export type VariationId = "none" | "some" | "considerable";
export const VARIATION_IDS = ["none", "some", "considerable"] as const;
export const DATE_DISTRIBUTION_IDS = [
  "constant_zero_v1",
  "symmetric_triangular_integer_v1",
] as const;
export const EFFECTIVENESS_DISTRIBUTION_IDS = [
  "constant_10000_v1",
  "symmetric_triangular_integer_v1",
] as const;
export const STREAM_FAMILY = "setup/technology_variation";

const DATE_SHIFT_MAX = 72;
const EFFECTIVENESS_MIN_BP = 8000;
const EFFECTIVENESS_MAX_BP = 12000;

const nonBlankString = Schema.String.check(Schema.isPattern(/\S/));
const dateShiftMonths = Schema.Int.check(
  Schema.isBetween({ minimum: -DATE_SHIFT_MAX, maximum: DATE_SHIFT_MAX }),
);
const effectivenessBp = Schema.Int.check(
  Schema.isBetween({ minimum: EFFECTIVENESS_MIN_BP, maximum: EFFECTIVENESS_MAX_BP }),
);

const TechnologyVariationProfileFieldsSchema = Schema.Struct({
  settingId: Schema.Literals(VARIATION_IDS),
  earliestDateShiftMonths: dateShiftMonths,
  latestDateShiftMonths: dateShiftMonths,
  effectivenessVariationMinBp: effectivenessBp,
  effectivenessVariationMaxBp: effectivenessBp,
  dateDistributionId: Schema.Literals(DATE_DISTRIBUTION_IDS),
  effectivenessDistributionId: Schema.Literals(EFFECTIVENESS_DISTRIBUTION_IDS),
  technologyEligibilityPredicateId: nonBlankString,
  variationFormulaVersion: nonBlankString,
  streamFamily: Schema.Literal(STREAM_FAMILY),
});

type ProfileFields = typeof TechnologyVariationProfileFieldsSchema.Type;

function shiftOrderViolated(
  p: Pick<ProfileFields, "earliestDateShiftMonths" | "latestDateShiftMonths">,
) {
  return p.earliestDateShiftMonths > p.latestDateShiftMonths;
}

function effectivenessOrderViolated(
  p: Pick<ProfileFields, "effectivenessVariationMinBp" | "effectivenessVariationMaxBp">,
) {
  return p.effectivenessVariationMinBp > p.effectivenessVariationMaxBp;
}

function noneProfileInconsistent(
  p: Pick<ProfileFields, "settingId" | "dateDistributionId" | "effectivenessDistributionId">,
) {
  return (
    p.settingId === "none" &&
    (p.dateDistributionId !== "constant_zero_v1" ||
      p.effectivenessDistributionId !== "constant_10000_v1")
  );
}

export const TechnologyVariationProfileSchema = TechnologyVariationProfileFieldsSchema.check(
  Schema.makeFilter(
    (p) =>
      !shiftOrderViolated(p) || "earliestDateShiftMonths must not exceed latestDateShiftMonths",
  ),
  Schema.makeFilter(
    (p) =>
      !effectivenessOrderViolated(p) ||
      "effectivenessVariationMinBp must not exceed effectivenessVariationMaxBp",
  ),
  Schema.makeFilter(
    (p) => !noneProfileInconsistent(p) || "none must use constant_zero_v1 / constant_10000_v1",
  ),
);

export type TechnologyVariationProfile = typeof TechnologyVariationProfileSchema.Type;
export const RNG_ALGORITHM_VERSION = "1";
export const CANONICAL_TECH_PROFILES: TechnologyVariationProfile[] = [
  {
    settingId: "none",
    earliestDateShiftMonths: 0,
    latestDateShiftMonths: 0,
    effectivenessVariationMinBp: 10_000,
    effectivenessVariationMaxBp: 10_000,
    dateDistributionId: "constant_zero_v1",
    effectivenessDistributionId: "constant_10000_v1",
    technologyEligibilityPredicateId: "default_v1",
    variationFormulaVersion: "1",
    streamFamily: STREAM_FAMILY,
  },
  {
    settingId: "some",
    earliestDateShiftMonths: -24,
    latestDateShiftMonths: 24,
    effectivenessVariationMinBp: 9_500,
    effectivenessVariationMaxBp: 10_500,
    dateDistributionId: "symmetric_triangular_integer_v1",
    effectivenessDistributionId: "symmetric_triangular_integer_v1",
    technologyEligibilityPredicateId: "default_v1",
    variationFormulaVersion: "1",
    streamFamily: STREAM_FAMILY,
  },
  {
    settingId: "considerable",
    earliestDateShiftMonths: -72,
    latestDateShiftMonths: 72,
    effectivenessVariationMinBp: 9_000,
    effectivenessVariationMaxBp: 11_000,
    dateDistributionId: "symmetric_triangular_integer_v1",
    effectivenessDistributionId: "symmetric_triangular_integer_v1",
    technologyEligibilityPredicateId: "default_v1",
    variationFormulaVersion: "1",
    streamFamily: STREAM_FAMILY,
  },
];
export interface TechnologyDefinition {
  technologyId: string;
  canonicalAvailabilityMonth: number;
  canonicalEffectValues: Record<string, number>;
  variationEligible: boolean;
  dateVariationEligible: boolean;
  effectivenessVariationEligible: boolean;
  earliestPermittedAvailabilityMonth: number;
  latestPermittedAvailabilityMonth: number;
  variableEffectIds: string[];
  prerequisiteTechnologyIds: string[];
  prerequisiteDelayMonths?: number | Record<string, number>;
  effectVariationBounds?: Record<string, { minBp: number; maxBp: number }>;
}
export interface TechnologyManifestEntry {
  technologyId: string;
  canonicalAvailabilityMonth: number;
  selectedDateShift: number;
  finalAvailabilityMonth: number;
  canonicalEffectValues: Record<string, number>;
  effectivenessMultiplier: number;
  finalVariedEffectValues: Record<string, number>;
  eligibilityFlags: {
    variationEligible: boolean;
    dateVariationEligible: boolean;
    effectivenessVariationEligible: boolean;
  };
  variationDecisionRecordIds: string[];
  contentHash: string;
  rulesetHash: string;
  formulaVersion: string;
}
export interface CampaignTechnologyManifest {
  entries: Record<string, TechnologyManifestEntry>;
  contentHash: string;
  rulesetHash: string;
  formulaVersion: string;
  manifestHash: string;
}

interface TechnologyManifestHashParts {
  entries: Record<string, TechnologyManifestEntry>;
  contentHash: string;
  rulesetHash: string;
  formulaVersion: string;
}

export function computeTechnologyManifestHash(parts: TechnologyManifestHashParts): string {
  return sha256Hex(
    canonicalSerialize({
      entries: parts.entries,
      contentHash: parts.contentHash,
      rulesetHash: parts.rulesetHash,
      formulaVersion: parts.formulaVersion,
    }),
  );
}

const PROFILE_STAGE = { stage: "technology-variation" } as const;
const PROFILE_CODE = "INVALID_TECHNOLOGY_VARIATION_PROFILE";

const PROFILE_FIELDS = Object.keys(TechnologyVariationProfileFieldsSchema.fields) as ReadonlyArray<
  keyof ProfileFields
>;

const decodeProfile = Schema.decodeUnknownResult(TechnologyVariationProfileSchema, {
  errors: "all",
  onExcessProperty: "error",
});

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function reportProfileFailure(
  row: Readonly<Record<string, unknown>>,
  keys: ReturnType<typeof issueKeys>,
  c: DiagnosticCollector,
): void {
  const add = (message: string) => c.addError(PROFILE_CODE, message, PROFILE_STAGE);
  const rejected = (field: string) => keys.invalid.has(field);

  if (rejected("settingId")) add(`Invalid settingId ${displayValue(row["settingId"])}`);

  const minD = row["earliestDateShiftMonths"];
  const maxD = row["latestDateShiftMonths"];
  if (
    rejected("earliestDateShiftMonths") ||
    rejected("latestDateShiftMonths") ||
    (isNumber(minD) &&
      isNumber(maxD) &&
      shiftOrderViolated({ earliestDateShiftMonths: minD, latestDateShiftMonths: maxD }))
  ) {
    add(
      `Date shift bounds invalid ${displayValue(minD)}..${displayValue(maxD)} (integers within -${DATE_SHIFT_MAX}..${DATE_SHIFT_MAX}, min<=max)`,
    );
  }

  const minE = row["effectivenessVariationMinBp"];
  const maxE = row["effectivenessVariationMaxBp"];
  if (
    rejected("effectivenessVariationMinBp") ||
    rejected("effectivenessVariationMaxBp") ||
    (isNumber(minE) &&
      isNumber(maxE) &&
      effectivenessOrderViolated({
        effectivenessVariationMinBp: minE,
        effectivenessVariationMaxBp: maxE,
      }))
  ) {
    add(
      `Effectiveness bounds ${displayValue(minE)}..${displayValue(maxE)} outside ${EFFECTIVENESS_MIN_BP}..${EFFECTIVENESS_MAX_BP} or min>max (integers)`,
    );
  }

  if (rejected("dateDistributionId")) {
    add(`Invalid dateDistributionId ${displayValue(row["dateDistributionId"])}`);
  }
  if (rejected("effectivenessDistributionId")) {
    add(`Invalid effectivenessDistributionId ${displayValue(row["effectivenessDistributionId"])}`);
  }
  if (rejected("streamFamily")) add(`streamFamily must be ${STREAM_FAMILY}`);
  if (rejected("technologyEligibilityPredicateId")) {
    add("technologyEligibilityPredicateId must be non-empty string");
  }
  if (rejected("variationFormulaVersion")) add("variationFormulaVersion must be non-empty string");

  if (
    row["settingId"] === "none" &&
    (row["dateDistributionId"] !== "constant_zero_v1" ||
      row["effectivenessDistributionId"] !== "constant_10000_v1")
  ) {
    add("none must use constant_zero_v1 / constant_10000_v1");
  }
  for (const key of [...keys.unexpected].sort(compareCodePoints)) add(`unknown field ${key}`);
}

export function validateTechnologyVariationProfile(p: unknown, c: DiagnosticCollector): boolean {
  if (typeof p !== "object" || p === null) {
    c.addError(PROFILE_CODE, "profile must be object", PROFILE_STAGE);
    return false;
  }
  const row = recordOf(p);
  const decoded = decodeProfile(row);
  if (Result.isSuccess(decoded)) return true;
  const keys = issueKeys(decoded.failure.issue);

  let anyMissing = false;
  for (const field of PROFILE_FIELDS) {
    if (keys.missing.has(field)) {
      c.addError(PROFILE_CODE, `Missing field ${field}`, PROFILE_STAGE);
      anyMissing = true;
    }
  }
  if (anyMissing) return false;
  reportProfileFailure(row, keys, c);
  return false;
}

export function validateTechnologyVariationProfiles(
  profiles: unknown,
  c: DiagnosticCollector,
): boolean {
  if (!Array.isArray(profiles)) {
    c.addError(PROFILE_CODE, "profiles must be an array", PROFILE_STAGE);
    return false;
  }
  if (profiles.length !== VARIATION_IDS.length) {
    c.addError(
      PROFILE_CODE,
      `Ruleset must contain exactly ${VARIATION_IDS.length} profiles, got ${profiles.length}`,
      PROFILE_STAGE,
    );
    return false;
  }
  const ids = new Set(
    profiles.map((p) =>
      typeof p === "object" && p !== null ? recordOf(p)["settingId"] : undefined,
    ),
  );
  for (const id of VARIATION_IDS) {
    if (!ids.has(id)) {
      c.addError(PROFILE_CODE, `Ruleset missing canonical profile ${id}`, PROFILE_STAGE);
      return false;
    }
  }
  let ok = true;
  for (const p of profiles) if (!validateTechnologyVariationProfile(p, c)) ok = false;
  return ok;
}

export function verifyTechnologyManifest(
  manifest: CampaignTechnologyManifest,
  c: DiagnosticCollector,
): boolean {
  const recomputed = computeTechnologyManifestHash({
    entries: manifest.entries,
    contentHash: manifest.contentHash,
    rulesetHash: manifest.rulesetHash,
    formulaVersion: manifest.formulaVersion,
  });
  if (recomputed !== manifest.manifestHash) {
    c.addError(
      "TECHNOLOGY_MANIFEST_MISMATCH",
      "Technology manifest hash mismatch after campaign creation",
      { stage: "technology-variation" },
    );
    return false;
  }
  return true;
}
