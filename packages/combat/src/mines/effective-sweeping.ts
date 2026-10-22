import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { MINE_BASIS_POINTS_PER_UNIT, type MineSweepResistance } from "./constants.js";
import {
  MINE_SWEEPING_DENOMINATOR,
  MINE_SWEEPING_FACTOR_KEYS,
  MINE_SWEEPING_ROUNDING,
  type MineSweepingFactorKey,
} from "./sweeping-base-values.js";
import { type MineTypeDefinition } from "./model.js";
import { MINE_SWEEP_RESISTANCE_MISSING, MINESWEEPING_SHIP_INELIGIBLE } from "./reasonCodes.js";

export interface EffectiveSweepingMultipliers {
  equipmentModeMultiplierBp: number;
  technologyMultiplierBp: number;
  crewMultiplierBp: number;
  readinessMultiplierBp: number;
  damageMultiplierBp: number;
  supportMultiplierBp: number;
}

export interface EffectiveSweepingValueResolution {
  baseSweepingValue: number;
  multipliers: EffectiveSweepingMultipliers;
  effectiveSweepingValue: SafeInt;
  rounding: {
    mode: string;
    numerator: string;
    denominator: string;
    rawFlooredValue: number;
  };
}

export function computeEffectiveSweepingValue(
  baseSweepingValue: number,
  multipliers: EffectiveSweepingMultipliers,
): EffectiveSweepingValueResolution {
  if (!Number.isInteger(baseSweepingValue) || baseSweepingValue <= 0)
    throw new BluewaveError(MINESWEEPING_SHIP_INELIGIBLE, {
      code: MINESWEEPING_SHIP_INELIGIBLE,
      factorKey: "baseSweepingValue",
      reason: "base sweeping value must be a positive integer (§7 input)",
      value: baseSweepingValue,
    });

  const factorKeys: readonly MineSweepingFactorKey[] = MINE_SWEEPING_FACTOR_KEYS;
  let numerator: bigint = BigInt(baseSweepingValue);
  for (const key of factorKeys) {
    const m: unknown = multipliers[key];
    if (m === undefined || m === null || !Number.isInteger(m) || (m as number) < 0) {
      throw new BluewaveError(MINESWEEPING_SHIP_INELIGIBLE, {
        code: MINESWEEPING_SHIP_INELIGIBLE,
        factorKey: key,
        reason: "missing, undefined, non-integer, or negative §9 multiplier",
        value: m,
      });
    }
    numerator = numerator * BigInt(m as number);
  }
  const rawFloored: bigint = numerator / MINE_SWEEPING_DENOMINATOR;
  const rawFlooredValue: number = Number(rawFloored);
  return {
    baseSweepingValue,
    multipliers: { ...multipliers },
    effectiveSweepingValue: SafeInt(rawFlooredValue),
    rounding: {
      mode: MINE_SWEEPING_ROUNDING,
      numerator: numerator.toString(),
      denominator: MINE_SWEEPING_DENOMINATOR.toString(),
      rawFlooredValue,
    },
  };
}

export function mineTypeSweepResistanceMultiplierBp(
  mineTypeDefinition: MineTypeDefinition,
  hasMatchingCapability: boolean,
): number {
  const r: MineSweepResistance = mineTypeDefinition.sweepResistance;
  if (!r) {
    throw new BluewaveError(MINE_SWEEP_RESISTANCE_MISSING, {
      code: MINE_SWEEP_RESISTANCE_MISSING,
      mineTypeId: mineTypeDefinition.mineTypeId,
      reason: "sweep-resistance metadata is missing on the mine type definition (§9)",
      sweepResistance: r,
    });
  }
  const isBp = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MINE_BASIS_POINTS_PER_UNIT;
  const rejectNonBp = (field: string, value: unknown): never => {
    throw new BluewaveError(MINE_SWEEP_RESISTANCE_MISSING, {
      code: MINE_SWEEP_RESISTANCE_MISSING,
      mineTypeId: mineTypeDefinition.mineTypeId,
      field,
      reason: "sweep-resistance multiplier must be an integer in [0, 10_000] basis points (§9)",
      value,
    });
  };
  switch (r.kind) {
    case "FLAT":
      return isBp(r.valueBp) ? r.valueBp : rejectNonBp("valueBp", r.valueBp);
    case "CAPABILITY_GATED": {
      const selected = hasMatchingCapability ? r.withCapabilityBp : r.withoutCapabilityBp;
      return isBp(selected) ? selected : rejectNonBp("capability-gated multiplier", selected);
    }
    case "DEFINITION_REQUIRED":
      throw new BluewaveError(MINE_SWEEP_RESISTANCE_MISSING, {
        code: MINE_SWEEP_RESISTANCE_MISSING,
        mineTypeId: mineTypeDefinition.mineTypeId,
        reason:
          "scenario-special resistance is definition-required and no definition is shipped (§9) — a downstream lookup without a value must fail",
      });
  }
}

export function computeTypeAdjustedSweeping(
  regionalSweepingValue: SafeInt,
  resistanceMultiplierBp: number,
): SafeInt {
  if (!SafeInt.isSafeInt(regionalSweepingValue) || regionalSweepingValue < 0)
    throw new BluewaveError(MINESWEEPING_SHIP_INELIGIBLE, {
      code: MINESWEEPING_SHIP_INELIGIBLE,
      factorKey: "regionalSweepingValue",
      reason: "regional sweeping value must be a non-negative integer",
      value: regionalSweepingValue,
    });
  if (!Number.isInteger(resistanceMultiplierBp) || resistanceMultiplierBp < 0)
    throw new BluewaveError(MINE_SWEEP_RESISTANCE_MISSING, {
      code: MINE_SWEEP_RESISTANCE_MISSING,
      factorKey: "resistanceMultiplierBp",
      reason: "mine-type resistance multiplier must be a non-negative integer",
      value: resistanceMultiplierBp,
    });
  const numerator = BigInt(regionalSweepingValue) * BigInt(resistanceMultiplierBp);
  return SafeInt(Number(numerator / BigInt(MINE_BASIS_POINTS_PER_UNIT)));
}
