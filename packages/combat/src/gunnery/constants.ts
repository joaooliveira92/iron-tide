//packages/combat/src/gunnery/constants.ts
// Versioned authoritative gunnery base constants (DESIGN-39 §§1-2) shipped as a
// `gunnery_v1` policy + `SHIPPED_GUNNERY_CONTRACT` + `validateGunneryContract`,
// mirroring packages/combat/src/movement/constants.ts. Fail-closed on mismatch.
// Grounded in docs/research/b3-m2-gunnery.md and recorded in the B-3 ADR (INC-5).
import { BluewaveError } from "@bluewave/contracts";
import { GUNNERY_RATE_FACTOR_MISSING, GUNNERY_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const gunneryPolicyId = "gunnery_v1" as const;

// fixed-point scale shared by every basis-point quantity in this subsystem.
export const BASIS_POINTS_PER_UNIT = 10_000 as const;

// DESIGN-39 §1 acquisition progress and fire-control solution quality are basis
// points restricted to [0, 10_000] (integer).
export const ACQUISITION_PROGRESS_MIN_BP = 0 as const;
export const ACQUISITION_PROGRESS_MAX_BP = 10_000 as const;
export const FIRE_CONTROL_SOLUTION_MIN_BP = 0 as const;
export const FIRE_CONTROL_SOLUTION_MAX_BP = 10_000 as const;

// Surface-mode firing guard: a battery MUST have a fire-control solution quality at
// or above this basis-point threshold to fire in a surface mode (DESIGN-39 §1
// fire-control solution quality; reason code GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT,
// spec §1.4). This is a versioned-ruleset constant recorded in ADR-0020 (INC-5);
// authored, not runtime-inferred. RAPID/AA eligibility predicates are deferred
// (modes.ts) and are not gated here.
export const SURFACE_FIRE_CONTROL_MINIMUM_BP = 2_000 as const;

// Canonial ammunition types tracked by exact integer count (DESIGN-39 §28). Seed
// set for this slice; a future ammunition slice may extend under a new version.
export const AMMUNITION_TYPES = ["ARMOR_PIERCING", "COMMON", "HIGH_EXPLOSIVE"] as const;
export type AmmunitionType = (typeof AMMUNITION_TYPES)[number];

// The seven canonical fire modes (DESIGN-39 §2). Closed union; see modes.ts for the
// per-mode records.
export const FIRE_MODES = [
  "CEASE_FIRE",
  "RANGING",
  "NORMAL",
  "RAPID",
  "AA_TRACKING",
  "AA_BARRAGE",
  "LOCAL_CONTROL",
] as const;
export type FireMode = (typeof FIRE_MODES)[number];

// ruleset + formula versions pinned by the gunnery_v1 contract.
export const GUNNERY_RULESET_VERSION = "gunnery_ruleset_v1" as const;
export const GUNNERY_FORMULA_VERSION = "gunnery_formula_v1" as const;

// ---------------------------------------------------------------------------
// DESIGN-39 §3 Accuracy factor manifest (INC-2). The 16 multiplier factors form
// the exact basis-point product below baseAccuracyBp, divided once by 10_000^16
// and floored once (not truncated) at the final accuracy check. Every factor
// MUST be explicit + versioned; a missing/undefined factor fails with
// GUNNERY_ACCURACY_FACTOR_MISSING (never a silent 10_000 fallback). Non-slice
// factors (range/visibility/radar/etc.) are pinned to neutral 10_000 as authored
// constants until their owning modifier track lands — not invented behavior.
export const gunneryAccuracyPolicyId = "gunnery_accuracy_v1" as const;

// Ordered canonical multiplier factor manifest (DESIGN-39 §3 order, 16 factors,
// excluding base accuracy). base + these 16 = 17 named factors overall.
export const GUNNERY_ACCURACY_FACTOR_KEYS = [
  "fireControl",
  "crew",
  "officer",
  "training",
  "range",
  "visibility",
  "radar",
  "ownManeuver",
  "targetManeuver",
  "previousSalvo",
  "seaState",
  "smoke",
  "damage",
  "multipleAttacker",
  "glare",
  "targetEvasion",
] as const;
export type GunneryAccuracyFactorKey = (typeof GUNNERY_ACCURACY_FACTOR_KEYS)[number];

// Neutral multiplier for every factor in this slice (1.0 basis-point scale).
export const NEUTRAL_ACCURACY_MULTIPLIER_BP = 10_000 as const;

// Final accuracy bounds (basis points) and the §3 exponent (16 multipliers).
export const GUNNERY_ACCURACY_FINAL_MIN_BP = 0 as const;
export const GUNNERY_ACCURACY_FINAL_MAX_BP = 10_000 as const;
export const GUNNERY_ACCURACY_SCALE_EXPONENT = 16 as const;
export const GUNNERY_ACCURACY_ROUNDING = "floor" as const;

// Authored neutral constants for the non-slice factors pinned until their owning
// modifier track lands. Explicit names (not invented behavior); all neutral 10_000.
export const GUNNERY_ACCURACY_NEUTRAL_FACTORS: Record<GunneryAccuracyFactorKey, number> = {
  fireControl: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  crew: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  officer: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  training: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  range: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  visibility: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  radar: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  ownManeuver: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  targetManeuver: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  previousSalvo: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  seaState: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  smoke: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  damage: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  multipleAttacker: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  glare: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  targetEvasion: NEUTRAL_ACCURACY_MULTIPLIER_BP,
};

export interface GunneryContract {
  policyId: string;
  basisPointsPerUnit: number;
  acquisitionProgressMinBp: number;
  acquisitionProgressMaxBp: number;
  fireControlSolutionMinBp: number;
  fireControlSolutionMaxBp: number;
  surfaceFireControlMinimumBp: number;
  rulesetVersion: string;
  formulaVersion: string;
  ammunitionTypes: readonly AmmunitionType[];
  fireModes: readonly FireMode[];
}

export const SHIPPED_GUNNERY_CONTRACT: GunneryContract = {
  policyId: gunneryPolicyId,
  basisPointsPerUnit: BASIS_POINTS_PER_UNIT,
  acquisitionProgressMinBp: ACQUISITION_PROGRESS_MIN_BP,
  acquisitionProgressMaxBp: ACQUISITION_PROGRESS_MAX_BP,
  fireControlSolutionMinBp: FIRE_CONTROL_SOLUTION_MIN_BP,
  fireControlSolutionMaxBp: FIRE_CONTROL_SOLUTION_MAX_BP,
  surfaceFireControlMinimumBp: SURFACE_FIRE_CONTROL_MINIMUM_BP,
  rulesetVersion: GUNNERY_RULESET_VERSION,
  formulaVersion: GUNNERY_FORMULA_VERSION,
  ammunitionTypes: AMMUNITION_TYPES,
  fireModes: FIRE_MODES,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(GUNNERY_STATE_INVARIANT_FAILED, {
    code: GUNNERY_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateGunneryContract(
  c: Partial<GunneryContract> | null | undefined,
): asserts c is GunneryContract {
  if (!c) throwMismatch(c, "gunnery_v1 missing contract");
  if (c.policyId !== gunneryPolicyId) throwMismatch(c, "gunnery_v1 expectant policy id");
  if (c.basisPointsPerUnit !== BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "gunnery_v1 basis-point scale");
  if (
    c.acquisitionProgressMinBp !== ACQUISITION_PROGRESS_MIN_BP ||
    c.acquisitionProgressMaxBp !== ACQUISITION_PROGRESS_MAX_BP
  )
    throwMismatch(c, "gunnery_v1 acquisition bounds");
  if (
    c.fireControlSolutionMinBp !== FIRE_CONTROL_SOLUTION_MIN_BP ||
    c.fireControlSolutionMaxBp !== FIRE_CONTROL_SOLUTION_MAX_BP
  )
    throwMismatch(c, "gunnery_v1 fire-control solution bounds");
  if (c.surfaceFireControlMinimumBp !== SURFACE_FIRE_CONTROL_MINIMUM_BP)
    throwMismatch(c, "gunnery_v1 surface fire-control minimum");
  if (c.rulesetVersion !== GUNNERY_RULESET_VERSION || c.formulaVersion !== GUNNERY_FORMULA_VERSION)
    throwMismatch(c, "gunnery_v1 ruleset/formula versions");
  if (!c.ammunitionTypes || !arrayEquals(c.ammunitionTypes, AMMUNITION_TYPES))
    throwMismatch(c, "gunnery_v1 ammunition types");
  if (!c.fireModes || !arrayEquals(c.fireModes, FIRE_MODES))
    throwMismatch(c, "gunnery_v1 fire modes");
}

// DESIGN-39 §3 accuracy manifest contract (INC-2). Ships *_v1 policy id +
// factor manifest + scale bounds + rounding, fail-closed on any drift, mirroring
// the SHIPPED_*_CONTRACT + validate guard pattern above.
export interface GunneryAccuracyContract {
  policyId: string;
  basisPointsPerUnit: number;
  factorKeys: readonly GunneryAccuracyFactorKey[];
  neutralMultiplierBp: number;
  finalMinBp: number;
  finalMaxBp: number;
  scaleExponent: number;
  rounding: string;
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_GUNNERY_ACCURACY_CONTRACT: GunneryAccuracyContract = {
  policyId: gunneryAccuracyPolicyId,
  basisPointsPerUnit: BASIS_POINTS_PER_UNIT,
  factorKeys: GUNNERY_ACCURACY_FACTOR_KEYS,
  neutralMultiplierBp: NEUTRAL_ACCURACY_MULTIPLIER_BP,
  finalMinBp: GUNNERY_ACCURACY_FINAL_MIN_BP,
  finalMaxBp: GUNNERY_ACCURACY_FINAL_MAX_BP,
  scaleExponent: GUNNERY_ACCURACY_SCALE_EXPONENT,
  rounding: GUNNERY_ACCURACY_ROUNDING,
  rulesetVersion: GUNNERY_RULESET_VERSION,
  formulaVersion: GUNNERY_FORMULA_VERSION,
};

function throwAccuracyMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(GUNNERY_STATE_INVARIANT_FAILED, {
    code: GUNNERY_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

export function validateGunneryAccuracyContract(
  c: Partial<GunneryAccuracyContract> | null | undefined,
): asserts c is GunneryAccuracyContract {
  if (!c) throwAccuracyMismatch(c, "gunnery_accuracy_v1 missing contract");
  if (c.policyId !== gunneryAccuracyPolicyId)
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 expectant policy id");
  if (c.basisPointsPerUnit !== BASIS_POINTS_PER_UNIT)
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 basis-point scale");
  if (!c.factorKeys || !arrayEquals(c.factorKeys, GUNNERY_ACCURACY_FACTOR_KEYS))
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 factor manifest");
  if (c.neutralMultiplierBp !== NEUTRAL_ACCURACY_MULTIPLIER_BP)
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 neutral multiplier");
  if (
    c.finalMinBp !== GUNNERY_ACCURACY_FINAL_MIN_BP ||
    c.finalMaxBp !== GUNNERY_ACCURACY_FINAL_MAX_BP
  )
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 final bounds");
  if (c.scaleExponent !== GUNNERY_ACCURACY_SCALE_EXPONENT)
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 scale exponent");
  if (c.rounding !== GUNNERY_ACCURACY_ROUNDING)
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 rounding mode");
  if (c.rulesetVersion !== GUNNERY_RULESET_VERSION || c.formulaVersion !== GUNNERY_FORMULA_VERSION)
    throwAccuracyMismatch(c, "gunnery_accuracy_v1 ruleset/formula versions");
}

// ---------------------------------------------------------------------------
// DESIGN-39 §4 Rate-of-fire factor manifest (INC-3). The 11 multiplier factors
// apply in the §4 order 1-11 (gun-quality → mount → autoloader → crew →
// technology → turn-state → sea-state → smoke → damage → range/fire-control-cycle
// → ammunition-state). effectiveReloadMs = ceil(baseReloadMs * 10_000^n /
// Π rateMultipliersBp) where n = number of applied rate multipliers. Every factor
// MUST be explicit + versioned; a missing/undefined factor (other than gun-quality,
// which a definition MAY legally omit via a no-rate-effect declaration, DESIGN-39
// §5) fails with GUNNERY_RATE_FACTOR_MISSING (never a silent 10_000 fallback).
// Deferred factors (mount/autoloader/turn-state/sea-state/smoke/damage/
// range-cycle/ammunition-state) are pinned to neutral 10_000 as authored constants
// until their owning modifier track lands — not invented behavior.
export const gunneryRatePolicyId = "gunnery_rate_v1" as const;

// Ordered canonical rate multiplier factor manifest (DESIGN-39 §4 order 1-11).
export const GUNNERY_RATE_FACTOR_KEYS = [
  "gunQuality",
  "mount",
  "autoloader",
  "crew",
  "technology",
  "turnState",
  "seaState",
  "smoke",
  "damage",
  "rangeOrFireControlCycle",
  "ammunitionState",
] as const;
export type GunneryRateFactorKey = (typeof GUNNERY_RATE_FACTOR_KEYS)[number];

// Neutral multiplier for each factor (1.0 basis-point scale).
export const NEUTRAL_RATE_MULTIPLIER_BP = 10_000 as const;

// The §4 exponent (11 multipliers) and rounding mode (CEIL, contrasting accuracy's FLOOR).
export const GUNNERY_RATE_SCALE_EXPONENT = 11 as const;
export const GUNNERY_RATE_ROUNDING = "ceil" as const;

// Authored neutral constants for the deferred factors pinned until their owning
// modifier track lands. All neural 10_000; gun-quality and crew/technology are the
// shipped real surface exercised by rateOfFire.ts.
export const GUNNERY_RATE_NEUTRAL_FACTORS: Record<GunneryRateFactorKey, number> = {
  gunQuality: NEUTRAL_RATE_MULTIPLIER_BP,
  mount: NEUTRAL_RATE_MULTIPLIER_BP,
  autoloader: NEUTRAL_RATE_MULTIPLIER_BP,
  crew: NEUTRAL_RATE_MULTIPLIER_BP,
  technology: NEUTRAL_RATE_MULTIPLIER_BP,
  turnState: NEUTRAL_RATE_MULTIPLIER_BP,
  seaState: NEUTRAL_RATE_MULTIPLIER_BP,
  smoke: NEUTRAL_RATE_MULTIPLIER_BP,
  damage: NEUTRAL_RATE_MULTIPLIER_BP,
  rangeOrFireControlCycle: NEUTRAL_RATE_MULTIPLIER_BP,
  ammunitionState: NEUTRAL_RATE_MULTIPLIER_BP,
};

export interface GunneryRateContract {
  policyId: string;
  basisPointsPerUnit: number;
  factorKeys: readonly GunneryRateFactorKey[];
  neutralMultiplierBp: number;
  scaleExponent: number; // 11 = number of rate multipliers in the §4 product
  rounding: string; // "ceil"
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_GUNNERY_RATE_CONTRACT: GunneryRateContract = {
  policyId: gunneryRatePolicyId,
  basisPointsPerUnit: BASIS_POINTS_PER_UNIT,
  factorKeys: GUNNERY_RATE_FACTOR_KEYS,
  neutralMultiplierBp: NEUTRAL_RATE_MULTIPLIER_BP,
  scaleExponent: GUNNERY_RATE_SCALE_EXPONENT,
  rounding: GUNNERY_RATE_ROUNDING,
  rulesetVersion: GUNNERY_RULESET_VERSION,
  formulaVersion: GUNNERY_FORMULA_VERSION,
};

function throwRateMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(GUNNERY_STATE_INVARIANT_FAILED, {
    code: GUNNERY_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

export function validateGunneryRateContract(
  c: Partial<GunneryRateContract> | null | undefined,
): asserts c is GunneryRateContract {
  if (!c) throwRateMismatch(c, "gunnery_rate_v1 missing contract");
  if (c.policyId !== gunneryRatePolicyId)
    throwRateMismatch(c, "gunnery_rate_v1 expectant policy id");
  if (c.basisPointsPerUnit !== BASIS_POINTS_PER_UNIT)
    throwRateMismatch(c, "gunnery_rate_v1 basis-point scale");
  if (!c.factorKeys || !arrayEquals(c.factorKeys, GUNNERY_RATE_FACTOR_KEYS))
    throwRateMismatch(c, "gunnery_rate_v1 factor manifest (§4 order 1-11)");
  if (c.neutralMultiplierBp !== NEUTRAL_RATE_MULTIPLIER_BP)
    throwRateMismatch(c, "gunnery_rate_v1 neutral multiplier");
  if (c.scaleExponent !== GUNNERY_RATE_SCALE_EXPONENT)
    throwRateMismatch(c, "gunnery_rate_v1 scale exponent");
  if (c.rounding !== GUNNERY_RATE_ROUNDING) throwRateMismatch(c, "gunnery_rate_v1 rounding mode");
  if (c.rulesetVersion !== GUNNERY_RULESET_VERSION || c.formulaVersion !== GUNNERY_FORMULA_VERSION)
    throwRateMismatch(c, "gunnery_rate_v1 ruleset/formula versions");
}

// ---------------------------------------------------------------------------
// DESIGN-39 §5 Gun quality (INC-3). Integer -3..+2 inclusive, each with shipped
// range/penetration/rate multipliers in basis points (§5): -3 → 8_500, -2 →
// 9_000, -1 → 9_500, 0 → 10_000, +1 → 10_500, +2 → 11_000. Out-of-range quality
// fails with GUN_QUALITY_OUT_OF_RANGE. A gun/mount definition MAY declare quality
// does not affect rate of fire (the rate multiplier is then omitted from the §4
// product; rateOfFire.ts handles that).
export const gunneryGunQualityPolicyId = "gun_quality_v1" as const;

export const GUN_QUALITY_MIN = -3 as const;
export const GUN_QUALITY_MAX = 2 as const;

export interface GunQualityMultipliers {
  rangeBp: number;
  penetrationBp: number;
  rateBp: number;
}

// Shipped §5 table keyed by integer gun quality.
export const GUN_QUALITY_TABLE = {
  "-3": { rangeBp: 8_500, penetrationBp: 8_500, rateBp: 8_500 },
  "-2": { rangeBp: 9_000, penetrationBp: 9_000, rateBp: 9_000 },
  "-1": { rangeBp: 9_500, penetrationBp: 9_500, rateBp: 9_500 },
  "0": { rangeBp: 10_000, penetrationBp: 10_000, rateBp: 10_000 },
  "1": { rangeBp: 10_500, penetrationBp: 10_500, rateBp: 10_500 },
  "2": { rangeBp: 11_000, penetrationBp: 11_000, rateBp: 11_000 },
} as const satisfies Record<string, Readonly<GunQualityMultipliers>>;

export interface GunQualityContract {
  policyId: string;
  minQuality: number;
  maxQuality: number;
  // Serialized body: table entries keyed by integer quality string.
  table: Record<string, Readonly<GunQualityMultipliers>>;
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_GUN_QUALITY_CONTRACT: GunQualityContract = {
  policyId: gunneryGunQualityPolicyId,
  minQuality: GUN_QUALITY_MIN,
  maxQuality: GUN_QUALITY_MAX,
  table: GUN_QUALITY_TABLE,
  rulesetVersion: GUNNERY_RULESET_VERSION,
  formulaVersion: GUNNERY_FORMULA_VERSION,
};

function throwGunQualityMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(GUNNERY_STATE_INVARIANT_FAILED, {
    code: GUNNERY_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function tableEquals(
  a: Record<string, Readonly<GunQualityMultipliers>>,
  b: Record<string, Readonly<GunQualityMultipliers>>,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!arrayEquals(aKeys, bKeys)) return false;
  return aKeys.every((k) => {
    const am = a[k];
    const bm = b[k];
    return (
      am !== undefined &&
      bm !== undefined &&
      am.rangeBp === bm.rangeBp &&
      am.penetrationBp === bm.penetrationBp &&
      am.rateBp === bm.rateBp
    );
  });
}

export function validateGunQualityContract(
  c: Partial<GunQualityContract> | null | undefined,
): asserts c is GunQualityContract {
  if (!c) throwGunQualityMismatch(c, "gun_quality_v1 missing contract");
  if (c.policyId !== gunneryGunQualityPolicyId)
    throwGunQualityMismatch(c, "gun_quality_v1 expectant policy id");
  if (c.minQuality !== GUN_QUALITY_MIN || c.maxQuality !== GUN_QUALITY_MAX)
    throwGunQualityMismatch(c, "gun_quality_v1 bounds (-3..+2)");
  if (!c.table || !tableEquals(c.table, GUN_QUALITY_TABLE))
    throwGunQualityMismatch(c, "gun_quality_v1 shipped multiplier table");
  if (c.rulesetVersion !== GUNNERY_RULESET_VERSION || c.formulaVersion !== GUNNERY_FORMULA_VERSION)
    throwGunQualityMismatch(c, "gun_quality_v1 ruleset/formula versions");
}

// ---------------------------------------------------------------------------
// Naval gun ballistics constant set (INC-5 content deliverable). baseReloadMs
// by broad caliber, research-grounded in docs/research/b3-m2-gunnery.md §1
// (NavWeaps-compiled per-gun cyclic-rate figures). Six calibers are directly
// grounded; the 1880s RML heavy-gun caliber has no primary-sourced precise
// integer (source: "1-5 min/round", no single table pins one figure) and is
// authored as an explicit BALANCE TARGET at the midpoint of the research-
// recommended 120_000-300_000 ms range — recorded in ADR-0020, never silently
// invented (ENGINEERING-CONTRACT failure policy).
export const gunneryBallisticsPolicyId = "gunnery_ballistics_v1" as const;

export const GUNNERY_CALIBERS = [
  "CAL_6IN_152MM",
  "CAL_8IN_203MM",
  "CAL_12IN_305MM",
  "CAL_14IN_356MM",
  "CAL_15IN_381MM",
  "CAL_16IN_406MM",
  "CAL_RML_HEAVY_1880",
] as const;
export type GunneryCaliber = (typeof GUNNERY_CALIBERS)[number];

// DESIGN-39 §4 baseReloadMilliseconds by broad caliber (research doc §1 table).
export const BASE_RELOAD_MS_BY_CALIBER: Record<GunneryCaliber, number> = {
  CAL_6IN_152MM: 7_000,
  CAL_8IN_203MM: 18_000,
  CAL_12IN_305MM: 25_000,
  CAL_14IN_356MM: 36_000,
  CAL_15IN_381MM: 35_000,
  CAL_16IN_406MM: 40_000,
  // BALANCE TARGET (ADR-0020): 1880s scen_1880 muzzle-loading heavy guns have no
  // primary-sourced precise integer; authored at the midpoint of the grounded
  // 120_000-300_000 ms (2-5 min/round) range.
  CAL_RML_HEAVY_1880: 210_000,
};

export interface GunneryBallisticsContract {
  policyId: string;
  calibers: readonly GunneryCaliber[];
  baseReloadMsByCaliber: Record<GunneryCaliber, number>;
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_GUNNERY_BALLISTICS_CONTRACT: GunneryBallisticsContract = {
  policyId: gunneryBallisticsPolicyId,
  calibers: GUNNERY_CALIBERS,
  baseReloadMsByCaliber: BASE_RELOAD_MS_BY_CALIBER,
  rulesetVersion: GUNNERY_RULESET_VERSION,
  formulaVersion: GUNNERY_FORMULA_VERSION,
};

function throwBallisticsMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(GUNNERY_STATE_INVARIANT_FAILED, {
    code: GUNNERY_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function baseReloadTableEquals(
  a: Record<GunneryCaliber, number>,
  b: Record<GunneryCaliber, number>,
): boolean {
  return GUNNERY_CALIBERS.every((c) => a[c] === b[c]);
}

export function validateGunneryBallisticsContract(
  c: Partial<GunneryBallisticsContract> | null | undefined,
): asserts c is GunneryBallisticsContract {
  if (!c) throwBallisticsMismatch(c, "gunnery_ballistics_v1 missing contract");
  if (c.policyId !== gunneryBallisticsPolicyId)
    throwBallisticsMismatch(c, "gunnery_ballistics_v1 expectant policy id");
  if (!c.calibers || !arrayEquals(c.calibers, GUNNERY_CALIBERS))
    throwBallisticsMismatch(c, "gunnery_ballistics_v1 caliber set");
  if (
    !c.baseReloadMsByCaliber ||
    !baseReloadTableEquals(c.baseReloadMsByCaliber, BASE_RELOAD_MS_BY_CALIBER)
  )
    throwBallisticsMismatch(c, "gunnery_ballistics_v1 base reload ms table");
  if (c.rulesetVersion !== GUNNERY_RULESET_VERSION || c.formulaVersion !== GUNNERY_FORMULA_VERSION)
    throwBallisticsMismatch(c, "gunnery_ballistics_v1 ruleset/formula versions");
}

// Fail-closed lookup: baseReloadMilliseconds for a shipped caliber. An unknown
// caliber fails with GUNNERY_RATE_FACTOR_MISSING (never a silent default),
// mirroring the "no silent fallback" policy for every other §4 rate factor.
export function baseReloadMsForCaliber(caliber: string): number {
  if (!(GUNNERY_CALIBERS as readonly string[]).includes(caliber)) {
    throw new BluewaveError(GUNNERY_RATE_FACTOR_MISSING, {
      code: GUNNERY_RATE_FACTOR_MISSING,
      factorKey: "baseReloadMs",
      reason: "unknown gunnery caliber — no shipped baseReloadMilliseconds for this caliber",
      value: caliber,
    });
  }
  return BASE_RELOAD_MS_BY_CALIBER[caliber as GunneryCaliber];
}
