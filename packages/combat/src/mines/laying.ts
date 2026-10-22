import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { MINE_LAYING_SOURCE_INELIGIBLE, MINE_INVENTORY_INSUFFICIENT } from "./reasonCodes.js";

export const mineLayingMultipliersPolicyId = "mine_laying_multipliers_v1" as const;

const LAYING_SCALE_N = 10_000n;
export const MINE_LAYING_DENOMINATOR: bigint = LAYING_SCALE_N ** 6n;

export const MINE_LAYING_TECHNOLOGY_FULL_BP = 10_000 as const;
export const MINE_LAYING_TECHNOLOGY_PARTIAL_EARLY_BP = 7_500 as const;
export const MINE_LAYING_TECHNOLOGY_UNSUPPORTED_BP = 0 as const;

export interface CrewQualityBand {
  min: number;
  max: number;
  multiplierBp: number;
}

export const MINE_LAYING_CREW_BANDS: readonly CrewQualityBand[] = [
  { min: 0, max: 39, multiplierBp: 7_500 },
  { min: 40, max: 59, multiplierBp: 10_000 },
  { min: 60, max: 79, multiplierBp: 11_000 },
  { min: 80, max: 100, multiplierBp: 12_000 },
];

export const MINE_LAYING_READINESS_INELIGIBLE_BELOW_BP = 40 as const;

export interface ReadinessBand {
  min: number;
  max: number;
  multiplierBp: number;
}

export const MINE_LAYING_READINESS_BANDS: readonly ReadinessBand[] = [
  { min: 40, max: 59, multiplierBp: 7_500 },
  { min: 60, max: 79, multiplierBp: 10_000 },
  { min: 80, max: 100, multiplierBp: 11_000 },
];

export const MINE_LAYING_DAMAGE_OPERATIONAL_BP = MINE_BASIS_POINTS_PER_UNIT;
export const MINE_LAYING_DAMAGE_DEGRADED_BP = 5_000 as const;
export const MINE_LAYING_DAMAGE_INOPERATIVE_BP = 0 as const;

export const MINE_LAYING_SUPPLY_ELIGIBLE_BP = MINE_BASIS_POINTS_PER_UNIT;
export const MINE_LAYING_SUPPLY_INELIGIBLE_BP = 0 as const;

export const MINE_LAYING_MISSION_ELIGIBLE_BP = MINE_BASIS_POINTS_PER_UNIT;
export const MINE_LAYING_MISSION_INELIGIBLE_BP = 0 as const;

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

export function supplyMultiplierBp(supplyEligible: boolean): number {
  return supplyEligible ? MINE_LAYING_SUPPLY_ELIGIBLE_BP : MINE_LAYING_SUPPLY_INELIGIBLE_BP;
}

export function missionMultiplierBp(missionSupported: boolean): number {
  return missionSupported ? MINE_LAYING_MISSION_ELIGIBLE_BP : MINE_LAYING_MISSION_INELIGIBLE_BP;
}

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
  effectiveLayingValue: SafeInt;
  rounding: {
    mode: string;
    numerator: string;
    denominator: string;
    rawFlooredValue: number;
  };
}

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

export interface DeductedMineInventory {
  inventoryAfter: SafeInt;
  consumedQuantity: SafeInt;
}

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
