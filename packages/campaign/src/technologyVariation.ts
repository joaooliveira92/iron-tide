import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export type VariationId = "none" | "some" | "considerable";
export const VARIATION_IDS = ["none", "some", "considerable"] as const;
export interface TechnologyVariationProfile {
  settingId: VariationId;
  earliestDateShiftMonths: number;
  latestDateShiftMonths: number;
  effectivenessVariationMinBp: number;
  effectivenessVariationMaxBp: number;
  dateDistributionId: string;
  effectivenessDistributionId: string;
  technologyEligibilityPredicateId: string;
  variationFormulaVersion: string;
  streamFamily: string;
}
export const RNG_ALGORITHM_VERSION = "1";
export const STREAM_FAMILY = "setup/technology_variation";
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

const ALLOWED_DATE_DIST = new Set(["constant_zero_v1", "symmetric_triangular_integer_v1"]);
const ALLOWED_EFF_DIST = new Set(["constant_10000_v1", "symmetric_triangular_integer_v1"]);

const REQUIRED_PROFILE_FIELDS = [
  "settingId",
  "earliestDateShiftMonths",
  "latestDateShiftMonths",
  "effectivenessVariationMinBp",
  "effectivenessVariationMaxBp",
  "dateDistributionId",
  "effectivenessDistributionId",
  "technologyEligibilityPredicateId",
  "variationFormulaVersion",
  "streamFamily",
] as const;

function hasRequiredProfileFields(r: Record<string, unknown>, c: DiagnosticCollector): boolean {
  let ok = true;
  for (const f of REQUIRED_PROFILE_FIELDS)
    if (!(f in r)) {
      c.addError("INVALID_TECHNOLOGY_VARIATION_PROFILE", `Missing field ${f}`, {
        stage: "technology-variation",
      });
      ok = false;
    }
  return ok;
}

function validateProfileSettingId(r: Record<string, unknown>, c: DiagnosticCollector): boolean {
  if (!["none", "some", "considerable"].includes(r["settingId"] as string)) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      `Invalid settingId ${String(r["settingId"])}`,
      { stage: "technology-variation" },
    );
    return false;
  }
  return true;
}

function validateProfileDateBounds(r: Record<string, unknown>, c: DiagnosticCollector): boolean {
  const minD = r["earliestDateShiftMonths"] as number;
  const maxD = r["latestDateShiftMonths"] as number;
  if (
    !Number.isInteger(minD) ||
    !Number.isInteger(maxD) ||
    !Number.isFinite(minD) ||
    !Number.isFinite(maxD) ||
    Math.abs(minD) > 72 ||
    Math.abs(maxD) > 72 ||
    minD > maxD
  ) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      `Date shift bounds invalid ${String(minD)}..${String(maxD)} (integers within -72..72, min<=max)`,
      { stage: "technology-variation" },
    );
    return false;
  }
  return true;
}

function validateProfileEffectivenessBounds(
  r: Record<string, unknown>,
  c: DiagnosticCollector,
): boolean {
  const minE = r["effectivenessVariationMinBp"] as number;
  const maxE = r["effectivenessVariationMaxBp"] as number;
  if (
    !Number.isInteger(minE) ||
    !Number.isInteger(maxE) ||
    !Number.isFinite(minE) ||
    !Number.isFinite(maxE) ||
    minE < 8000 ||
    maxE > 12000 ||
    minE > maxE
  ) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      `Effectiveness bounds ${String(minE)}..${String(maxE)} outside 8000..12000 or min>max (integers)`,
      { stage: "technology-variation" },
    );
    return false;
  }
  return true;
}

function validateProfileDistributionIds(
  r: Record<string, unknown>,
  c: DiagnosticCollector,
): boolean {
  let ok = true;
  if (!ALLOWED_DATE_DIST.has(r["dateDistributionId"] as string)) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      `Invalid dateDistributionId ${String(r["dateDistributionId"])}`,
      { stage: "technology-variation" },
    );
    ok = false;
  }
  if (!ALLOWED_EFF_DIST.has(r["effectivenessDistributionId"] as string)) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      `Invalid effectivenessDistributionId ${String(r["effectivenessDistributionId"])}`,
      { stage: "technology-variation" },
    );
    ok = false;
  }
  return ok;
}

function validateProfileMetadata(r: Record<string, unknown>, c: DiagnosticCollector): boolean {
  let ok = true;
  if ((r["streamFamily"] as string) !== STREAM_FAMILY) {
    c.addError("INVALID_TECHNOLOGY_VARIATION_PROFILE", `streamFamily must be ${STREAM_FAMILY}`, {
      stage: "technology-variation",
    });
    ok = false;
  }
  if (
    typeof r["technologyEligibilityPredicateId"] !== "string" ||
    (r["technologyEligibilityPredicateId"] as string).trim() === ""
  ) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      "technologyEligibilityPredicateId must be non-empty string",
      { stage: "technology-variation" },
    );
    ok = false;
  }
  if (
    typeof r["variationFormulaVersion"] !== "string" ||
    (r["variationFormulaVersion"] as string).trim() === ""
  ) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      "variationFormulaVersion must be non-empty string",
      { stage: "technology-variation" },
    );
    ok = false;
  }
  return ok;
}

function validateProfileNoneConsistency(
  r: Record<string, unknown>,
  c: DiagnosticCollector,
): boolean {
  if (
    r["settingId"] === "none" &&
    (r["dateDistributionId"] !== "constant_zero_v1" ||
      r["effectivenessDistributionId"] !== "constant_10000_v1")
  ) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      "none must use constant_zero_v1 / constant_10000_v1",
      { stage: "technology-variation" },
    );
    return false;
  }
  return true;
}

export function validateTechnologyVariationProfile(p: unknown, c: DiagnosticCollector): boolean {
  const r = p as Record<string, unknown>;
  if (typeof r !== "object" || r === null) {
    c.addError("INVALID_TECHNOLOGY_VARIATION_PROFILE", "profile must be object", {
      stage: "technology-variation",
    });
    return false;
  }
  if (!hasRequiredProfileFields(r, c)) return false;

  const results = [
    validateProfileSettingId(r, c),
    validateProfileDateBounds(r, c),
    validateProfileEffectivenessBounds(r, c),
    validateProfileDistributionIds(r, c),
    validateProfileMetadata(r, c),
    validateProfileNoneConsistency(r, c),
  ];
  return results.every(Boolean);
}

export function validateTechnologyVariationProfiles(
  profiles: unknown,
  c: DiagnosticCollector,
): boolean {
  if (!Array.isArray(profiles)) {
    c.addError("INVALID_TECHNOLOGY_VARIATION_PROFILE", "profiles must be an array", {
      stage: "technology-variation",
    });
    return false;
  }
  if (profiles.length !== VARIATION_IDS.length) {
    c.addError(
      "INVALID_TECHNOLOGY_VARIATION_PROFILE",
      `Ruleset must contain exactly ${VARIATION_IDS.length} profiles, got ${profiles.length}`,
      { stage: "technology-variation" },
    );
    return false;
  }
  const ids = new Set((profiles as TechnologyVariationProfile[]).map((p) => p.settingId));
  for (const id of VARIATION_IDS) {
    if (!ids.has(id)) {
      c.addError(
        "INVALID_TECHNOLOGY_VARIATION_PROFILE",
        `Ruleset missing canonical profile ${id}`,
        { stage: "technology-variation" },
      );
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
