// DESIGN-35 §9 effective sweeping value (INC-3):
//
//   effectiveSweepingValue = floor(baseSweepingValue * equipmentModeMultiplierBp *
//     technologyMultiplierBp * crewMultiplierBp * readinessMultiplierBp *
//     damageMultiplierBp * supportMultiplierBp / 10_000^6)
//
// The exact rational result is retained through all six multipliers and rounded
// ONCE with FLOOR (never per-factor rounding) — the same bigint-numerator +
// one-FLOOR discipline as §4's mine-laying value (laying.ts), with the SHARED
// 10_000^6 denominator (MINE_SWEEPING_DENOMINATOR, owned by
// sweeping-base-values.ts — the §7 module that also owns the bundled
// `mine_sweeping_v1` contract).
//
// Bound analysis (DESIGN-07): the raw numerator baseSweepingValue * Π six
// multiplierBp can reach ~150 * 12_000^6 ≈ 4.5e26 (the shipped crew band peaks
// at 12_000; 12_000^6 ≈ 2.99e24 alone already exceeds Number.MAX_SAFE_INTEGER
// ≈ 9.0e15). This proves bigint necessary for the intermediate product; the
// floored effectiveSweepingValue (≤ ~449 for the §7 base values) is a small
// non-negative integer and fits a plain safe integer.
//
// Mine-type resistance multipliers (§9) apply AFTER aggregation (INC-4), NOT
// per-ship here: computeEffectiveSweepingValue is the per-ship pre-resistance
// value. mineTypeSweepResistanceMultiplierBp resolves the §9 per-type
// multiplier from the shipped MineTypeDefinition.sweepResistance surface
// (model.ts, INC-1) — FLAT valueBp, CAPABILITY_GATED with/without capability,
// and DEFINITION_REQUIRED fails with MINE_SWEEP_RESISTANCE_MISSING (no
// scenario-special value is authored this sprint). computeTypeAdjustedSweeping
// is the pure §10 helper floor(regional * resistance / 10_000) that INC-4
// composes per mine-pressure record.
//
// Pure/deterministic: no I/O/clock/random.
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
  /** Sweep-mode multiplier from the resolved §8 mode (dual-equipment.ts). */
  equipmentModeMultiplierBp: number;
  /** Generic technology multiplier (shared §4 table, mine_laying_multipliers_v1). */
  technologyMultiplierBp: number;
  /** Generic crew multiplier (§4 band table). */
  crewMultiplierBp: number;
  /** Generic readiness multiplier (§4 band table). */
  readinessMultiplierBp: number;
  /** Generic damage multiplier (§4 table; OPERATIONAL/DEGRADED only per §6, but the formula accepts the full shipped range). */
  damageMultiplierBp: number;
  /** Generic support multiplier (support/fuel-supply, §4 supply multiplier). */
  supportMultiplierBp: number;
}

export interface EffectiveSweepingValueResolution {
  baseSweepingValue: number;
  multipliers: EffectiveSweepingMultipliers;
  /** The exact floored result: floor(base * Π(6) multipliers / 10_000^6). */
  effectiveSweepingValue: SafeInt;
  rounding: {
    mode: string; // "floor" — rounded once at the end, never mid-product
    numerator: string; // exact rational numerator (bigint as decimal string)
    denominator: string; // 10_000^6
    rawFlooredValue: number;
  };
}

// AC-9: computeEffectiveSweepingValue = floor(baseSweepingValue * Π six
// multiplierBp / 10_000^6) — exact rational through all six factors, one FLOOR
// via bigint (bound analysis at the top of this module). Missing / undefined /
// non-integer / negative multiplier fails with MINESWEEPING_SHIP_INELIGIBLE
// (never a silent 10_000 default, mirroring §4's computeEffectiveLayingValue):
// a ship whose sweeping configuration is not fully specified cannot contribute.
// Any zero multiplier yields 0 — the caller MUST treat zero value as "no
// sweeping contribution" (§6 zero-contribution semantics).
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

  // The §9 factor order is the shipped ordered factor-keys manifest (also
  // pinned in the mine_sweeping_v1 contract) — the product uses exactly the
  // six multipliers the formula names.
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
  // bigint integer division floors (all values non-negative), one round.
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

// AC-9: resolve the §9 mine-type resistance multiplier from the shipped
// MineTypeDefinition.sweepResistance surface (model.ts — the INC-1 shipped
// values ARE the §9 literals: CONTACT flat 10_000, MAGNETIC/ACOUSTIC
// capability-gated 10_000-with / 7_500-without, CONTROLLED_DEFENSIVE flat
// 5_000, SUBMARINE_LAID flat 9_000). A capability-gated type takes the with /
// without pair from the sweeping force's matching capability (magnetic-sweep
// for MAGNETIC, acoustic-sweep for ACOUSTIC). SCENARIO_SPECIAL is
// DEFINITION_REQUIRED: no authored resistance data exists, so resolution fails
// with MINE_SWEEP_RESISTANCE_MISSING — never a silent default.
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

// AC-9 helper (§10 relationship): typeAdjustedSweeping = floor(regionalSweepingValue *
// mineTypeResistanceMultiplierBp / 10_000). Belongs here as a pure §9/§10
// helper so INC-4 can compose the aggregate->record step without
// re-deriving integer rounding. The product stays in bigint (a large regional
// aggregate × up-to-10_000 bp exceeds Number's safe range), floored once.
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
