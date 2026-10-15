// DESIGN-35 §4 mine-laying value (INC-2):
//
//   effectiveLayingValue = floor(baseLayingValue * technologyMultiplierBp *
//     crewMultiplierBp * readinessMultiplierBp * damageMultiplierBp *
//     supplyMultiplierBp * missionMultiplierBp / 10_000^6)
//
// The exact rational result is retained through all six multipliers and
// rounded ONCE with FLOOR at the end (never per-factor rounding). The shipped
// generic multiplier table (mine_laying_multipliers_v1) carries DESIGN-35's
// exact §4 integers: technology 10_000/7_500, crew 7_500/10_000/11_000/12_000
// by band, readiness ineligible-below-40 + 7_500/10_000/11_000 by band,
// degraded damage 5_000, unsupported or fuel-ineligible source 0. A readiness
// below 40 makes the source INELIGIBLE (MINE_LAYING_SOURCE_INELIGIBLE — same
// failure as §3 eligibility, per ticket 04's narrow reading); a zero multiplier
// makes the whole value 0, so the caller must treat zero value as no laying
// (the record must not be created).
//
// Bound analysis (DESIGN-07): the raw numerator baseLayingValue * Π multiplierBp
// can reach ~10^26 (six factors each <= 12_000 give 12_000^6 ≈ 2.99e24, then a
// base laying value of ~100), far above Number.MAX_SAFE_INTEGER (~9.0e15). This
// proves bigint necessary for the intermediate product — the exact same shape
// gunnery accuracy.ts resolves with bigint; the floored effectiveLayingValue is
// a small non-negative integer and fits a plain safe integer.
//
// Mine inventory consumption EQUALS the laying action's exact declared quantity;
// an insufficient on-hand count fails with MINE_INVENTORY_INSUFFICIENT.
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { MINE_LAYING_SOURCE_INELIGIBLE, MINE_INVENTORY_INSUFFICIENT } from "./reasonCodes.js";

// Versioned policy id backing the shipped generic multiplier table.
export const mineLayingMultipliersPolicyId = "mine_laying_multipliers_v1" as const;

// Exact denominator 10_000^6 (bigint; 10^24 — within bigint, not Number range).
const LAYING_SCALE_N = 10_000n;
export const MINE_LAYING_DENOMINATOR: bigint = LAYING_SCALE_N ** 6n;

// ---- §4 shipped generic multiplier table (mine_laying_multipliers_v1) ----

export const MINE_LAYING_TECHNOLOGY_FULL_BP = 10_000 as const; // §4 literal
export const MINE_LAYING_TECHNOLOGY_PARTIAL_EARLY_BP = 7_500 as const; // §4 literal
export const MINE_LAYING_TECHNOLOGY_UNSUPPORTED_BP = 0 as const; // §4 "unsupported" bucket

export interface CrewQualityBand {
  min: number;
  max: number;
  multiplierBp: number;
}

// §4 literal crew bands. The bands tile the 0..100 integer range exactly.
export const MINE_LAYING_CREW_BANDS: readonly CrewQualityBand[] = [
  { min: 0, max: 39, multiplierBp: 7_500 },
  { min: 40, max: 59, multiplierBp: 10_000 },
  { min: 60, max: 79, multiplierBp: 11_000 },
  { min: 80, max: 100, multiplierBp: 12_000 },
];

export const MINE_LAYING_READINESS_INELIGIBLE_BELOW_BP = 40 as const; // §4 "readiness below 40: ineligible"

export interface ReadinessBand {
  min: number;
  max: number;
  multiplierBp: number;
}

// §4 literal readiness bands (below 40 is INELIGIBLE, handled by the lookup).
export const MINE_LAYING_READINESS_BANDS: readonly ReadinessBand[] = [
  { min: 40, max: 59, multiplierBp: 7_500 },
  { min: 60, max: 79, multiplierBp: 10_000 },
  { min: 80, max: 100, multiplierBp: 11_000 },
];

export const MINE_LAYING_DAMAGE_OPERATIONAL_BP = MINE_BASIS_POINTS_PER_UNIT; // authored neutral default
export const MINE_LAYING_DAMAGE_DEGRADED_BP = 5_000 as const; // §4 literal
export const MINE_LAYING_DAMAGE_INOPERATIVE_BP = 0 as const; // cannot-lay bucket (value 0 -> no laying)

export const MINE_LAYING_SUPPLY_ELIGIBLE_BP = MINE_BASIS_POINTS_PER_UNIT; // authored neutral default
export const MINE_LAYING_SUPPLY_INELIGIBLE_BP = 0 as const; // §4 "unsupported or fuel-ineligible source: 0"

export const MINE_LAYING_MISSION_ELIGIBLE_BP = MINE_BASIS_POINTS_PER_UNIT; // authored neutral default
export const MINE_LAYING_MISSION_INELIGIBLE_BP = 0 as const; // §4 "unsupported ... source: 0"

export interface MineLayingMultipliersContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  denominator: string;
  technologyFullBp: number;
  technologyPartialEarlyBp: number;
  technologyUnsupportedBp: number;
  crewBands: readonly CrewQualityBand[];
  readinessIneligibleBelowBp: number;
  readinessBands: readonly ReadinessBand[];
  damageOperationalBp: number;
  damageDegradedBp: number;
  damageInoperativeBp: number;
  supplyEligibleBp: number;
  supplyIneligibleBp: number;
  missionEligibleBp: number;
  missionIneligibleBp: number;
}

export const MINE_LAYING_MULTIPLIERS_CONTRACT: MineLayingMultipliersContract = {
  policyId: mineLayingMultipliersPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  denominator: MINE_LAYING_DENOMINATOR.toString(),
  technologyFullBp: MINE_LAYING_TECHNOLOGY_FULL_BP,
  technologyPartialEarlyBp: MINE_LAYING_TECHNOLOGY_PARTIAL_EARLY_BP,
  technologyUnsupportedBp: MINE_LAYING_TECHNOLOGY_UNSUPPORTED_BP,
  crewBands: MINE_LAYING_CREW_BANDS,
  readinessIneligibleBelowBp: MINE_LAYING_READINESS_INELIGIBLE_BELOW_BP,
  readinessBands: MINE_LAYING_READINESS_BANDS,
  damageOperationalBp: MINE_LAYING_DAMAGE_OPERATIONAL_BP,
  damageDegradedBp: MINE_LAYING_DAMAGE_DEGRADED_BP,
  damageInoperativeBp: MINE_LAYING_DAMAGE_INOPERATIVE_BP,
  supplyEligibleBp: MINE_LAYING_SUPPLY_ELIGIBLE_BP,
  supplyIneligibleBp: MINE_LAYING_SUPPLY_INELIGIBLE_BP,
  missionEligibleBp: MINE_LAYING_MISSION_ELIGIBLE_BP,
  missionIneligibleBp: MINE_LAYING_MISSION_INELIGIBLE_BP,
};

// ---- §4 lookup functions ----

// Technology capability multiplier. FULL = shipped 10_000 (§4); PARTIAL_EARLY =
// the explicitly-permitted early capability 7_500 (§4); ABSENT/unsupported = 0
// (§4 "unsupported ... source: 0").
export type MineLayingTechnologyState = "FULL" | "PARTIAL_EARLY" | "UNSUPPORTED";

export function technologyMultiplierBp(state: MineLayingTechnologyState): number {
  switch (state) {
    case "FULL":
      return MINE_LAYING_TECHNOLOGY_FULL_BP;
    case "PARTIAL_EARLY":
      return MINE_LAYING_TECHNOLOGY_PARTIAL_EARLY_BP;
    case "UNSUPPORTED":
      return MINE_LAYING_TECHNOLOGY_UNSUPPORTED_BP;
  }
}

function invalidQualifier(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(MINE_LAYING_SOURCE_INELIGIBLE, {
    code: MINE_LAYING_SOURCE_INELIGIBLE,
    field,
    reason,
    value,
  });
}

// Crew-quality multiplier, integer 0..100 (§4 band table). A non-integer or
// out-of-range quality fails with MINE_LAYING_SOURCE_INELIGIBLE — never a
// silent fallback.
export function crewMultiplierBp(crewQuality: number): number {
  if (!Number.isInteger(crewQuality) || crewQuality < 0 || crewQuality > 100)
    invalidQualifier(
      "crewQuality",
      crewQuality,
      "crew quality must be an integer within 0..100 (§4 bands)",
    );
  for (const band of MINE_LAYING_CREW_BANDS) {
    const c = band as CrewQualityBand;
    if (crewQuality >= c.min && crewQuality <= c.max) return c.multiplierBp;
  }
  return invalidQualifier("crewQuality", crewQuality, "crew quality outside shipped §4 bands");
}

// Readiness multiplier, integer 0..100 (§4 band table). Below 40 the source is
// INELIGIBLE (MINE_LAYING_SOURCE_INELIGIBLE); a non-integer or > 100 fails the
// same code (never a silent default).
export function readinessMultiplierBp(readiness: number): number {
  if (!Number.isInteger(readiness) || readiness < 0 || readiness > 100)
    invalidQualifier(
      "readiness",
      readiness,
      "readiness must be an integer within 0..100 (§4 bands)",
    );
  if (readiness < MINE_LAYING_READINESS_INELIGIBLE_BELOW_BP)
    invalidQualifier("readiness", readiness, "readiness below 40 is ineligible (§4)");
  for (const band of MINE_LAYING_READINESS_BANDS) {
    if (readiness >= band.min && readiness <= band.max) return band.multiplierBp;
  }
  return invalidQualifier("readiness", readiness, "readiness is not covered by shipped §4 bands");
}

// Damage multiplier by damage state (§4 "degraded damage: 5_000"). OPERATIONAL
// is the authored neutral 10_000; DEGRADED is the §4 literal 5_000; any
// inoperative/destroyed state cannot lay (0 -> no laying, §4 unsupported bucket).
export type MineLayingDamageState = "OPERATIONAL" | "DEGRADED" | "INOPERATIVE";

export function damageMultiplierBp(damageState: MineLayingDamageState): number {
  switch (damageState) {
    case "OPERATIONAL":
      return MINE_LAYING_DAMAGE_OPERATIONAL_BP;
    case "DEGRADED":
      return MINE_LAYING_DAMAGE_DEGRADED_BP;
    case "INOPERATIVE":
      return MINE_LAYING_DAMAGE_INOPERATIVE_BP;
  }
}

// Supply/fuel multiplier: an eligible source is neutral 10_000 (authored
// default); an unsupported or fuel-ineligible source is 0 (§4 literal bucket).
export function supplyMultiplierBp(supplyEligible: boolean): number {
  return supplyEligible ? MINE_LAYING_SUPPLY_ELIGIBLE_BP : MINE_LAYING_SUPPLY_INELIGIBLE_BP;
}

// Mission multiplier: a supported-capable source is neutral 10_000 (authored
// default); an unsupported source is 0 (§4 literal bucket).
export function missionMultiplierBp(missionSupported: boolean): number {
  return missionSupported ? MINE_LAYING_MISSION_ELIGIBLE_BP : MINE_LAYING_MISSION_INELIGIBLE_BP;
}

// ---- Exact §4 formula ----

export interface MineLayingMultipliers {
  technologyMultiplierBp: number;
  crewMultiplierBp: number;
  readinessMultiplierBp: number;
  damageMultiplierBp: number;
  supplyMultiplierBp: number;
  missionMultiplierBp: number;
}

export interface EffectiveLayingValueResolution {
  multipliers: MineLayingMultipliers;
  /** The exact strong result: floor(base * Π multipliers / 10_000^6). */
  effectiveLayingValue: SafeInt;
  rounding: {
    mode: string; // "floor" — rounded once, never truncated mid-product
    numerator: string; // exact rational numerator (bigint as decimal string)
    denominator: string; // 10_000^6
    rawFlooredValue: number;
  };
}

// AC-4: effectiveLayingValue = floor(baseLayingValue * Π six multiplierBp /
// 10_000^6) — exact rational through all six factors, rounded once with FLOOR.
// Missing / undefined / non-integer / negative multiplier fails with
// MINE_LAYING_SOURCE_INELIGIBLE (never a silent 10_000 default). Any zero
// multiplier (unsupported/fuel-ineligible source, inoperative damage) yields 0
// — the caller MUST treat zero value as "no laying, record not created".
export function computeEffectiveLayingValue(
  baseLayingValue: number,
  multipliers: MineLayingMultipliers,
): EffectiveLayingValueResolution {
  if (!Number.isInteger(baseLayingValue) || baseLayingValue <= 0)
    throw new BluewaveError(MINE_LAYING_SOURCE_INELIGIBLE, {
      code: MINE_LAYING_SOURCE_INELIGIBLE,
      factorKey: "baseLayingValue",
      reason: "base laying value must be a positive integer (§4 input)",
      value: baseLayingValue,
    });

  const keys = [
    "technologyMultiplierBp",
    "crewMultiplierBp",
    "readinessMultiplierBp",
    "damageMultiplierBp",
    "supplyMultiplierBp",
    "missionMultiplierBp",
  ] as const;
  let numerator: bigint = BigInt(baseLayingValue);
  for (const key of keys) {
    const m: unknown = multipliers[key];
    if (m === undefined || m === null || !Number.isInteger(m) || (m as number) < 0) {
      throw new BluewaveError(MINE_LAYING_SOURCE_INELIGIBLE, {
        code: MINE_LAYING_SOURCE_INELIGIBLE,
        factorKey: key,
        reason: "missing, undefined, non-integer, or negative §4 multiplier",
        value: m,
      });
    }
    numerator = numerator * BigInt(m as number);
  }
  // bigint integer division floors (all values non-negative).
  const rawFloored: bigint = numerator / MINE_LAYING_DENOMINATOR;
  const rawFlooredValue: number = Number(rawFloored);
  return {
    multipliers: { ...multipliers },
    effectiveLayingValue: SafeInt(rawFlooredValue),
    rounding: {
      mode: "floor",
      numerator: numerator.toString(),
      denominator: MINE_LAYING_DENOMINATOR.toString(),
      rawFlooredValue,
    },
  };
}

// ---- §4 inventory consumption ----

export interface DeductedMineInventory {
  /** On-hand inventory after consumption (availability reduced exactly by the declared quantity). */
  inventoryAfter: SafeInt;
  /** The exact quantity consumed — EQUALS the laying action's declared quantity. */
  consumedQuantity: SafeInt;
}

// AC-4: inventory consumption equals the laying action's exact declared
// quantity. An insufficient on-hand count (or a non-positive declared quantity)
// fails with MINE_INVENTORY_INSUFFICIENT — never a silent partial deduction.
export function consumeMineInventory(
  inventoryBefore: SafeInt,
  declaredQuantity: SafeInt,
): DeductedMineInventory {
  if (!SafeInt.isSafeInt(inventoryBefore) || inventoryBefore < 0)
    throw new BluewaveError(MINE_INVENTORY_INSUFFICIENT, {
      code: MINE_INVENTORY_INSUFFICIENT,
      field: "inventoryBefore",
      reason: "inventory before must be a non-negative integer",
      value: inventoryBefore,
    });
  if (!SafeInt.isSafeInt(declaredQuantity) || declaredQuantity <= 0)
    throw new BluewaveError(MINE_INVENTORY_INSUFFICIENT, {
      code: MINE_INVENTORY_INSUFFICIENT,
      field: "declaredQuantity",
      reason: "declared laying quantity must be a positive integer",
      value: declaredQuantity,
    });
  if (inventoryBefore < declaredQuantity)
    throw new BluewaveError(MINE_INVENTORY_INSUFFICIENT, {
      code: MINE_INVENTORY_INSUFFICIENT,
      field: "inventoryBefore",
      reason: "on-hand inventory is below the declared laying quantity",
      value: { inventoryBefore, declaredQuantity },
    });
  const inventoryAfter = SafeInt.sub(inventoryBefore, declaredQuantity);
  return { inventoryAfter, consumedQuantity: declaredQuantity };
}
