import { describe, expect, it } from "vite-plus/test";
import { SafeInt, BluewaveError } from "@bluewave/contracts";
import {
  computeEffectiveSweepingValue,
  computeTypeAdjustedSweeping,
  mineTypeDefinitionById,
  mineTypeSweepResistanceMultiplierBp,
  MINE_SWEEPING_DENOMINATOR,
  MINE_SWEEP_RESISTANCE_MISSING,
  MINESWEEPING_SHIP_INELIGIBLE,
  type EffectiveSweepingMultipliers,
} from "@bluewave/combat/mines";

function multipliers(
  overrides: Partial<EffectiveSweepingMultipliers> = {},
): EffectiveSweepingMultipliers {
  return {
    equipmentModeMultiplierBp: 10_000,
    technologyMultiplierBp: 10_000,
    crewMultiplierBp: 10_000,
    readinessMultiplierBp: 10_000,
    damageMultiplierBp: 10_000,
    supportMultiplierBp: 10_000,
    ...overrides,
  };
}

describe("AC-9: exact §9 formula — one exact product, one FLOOR", () => {
  it("all-neutral multipliers collapse to the base value", () => {
    const res = computeEffectiveSweepingValue(150, multipliers());
    expect(res.effectiveSweepingValue).toBe(150);
    expect(res.rounding.mode).toBe("floor");
    expect(res.rounding.denominator).toBe(MINE_SWEEPING_DENOMINATOR.toString());
  });

  it("floors a fractional exact rational exactly once (21.09375 -> 21)", () => {
    const res = computeEffectiveSweepingValue(
      100,
      multipliers({
        equipmentModeMultiplierBp: 7_500,
        technologyMultiplierBp: 7_500,
        crewMultiplierBp: 7_500,
        readinessMultiplierBp: 10_000,
        damageMultiplierBp: 5_000,
        supportMultiplierBp: 10_000,
      }),
    );
    expect(res.effectiveSweepingValue).toBe(21);
    expect(res.rounding.numerator).toBe("21093750000000000000000000");
  });

  it("one FLOOR, never per-factor rounding (1 × 0.9 × 1.2 = 1, not 0)", () => {
    const res = computeEffectiveSweepingValue(
      1,
      multipliers({
        equipmentModeMultiplierBp: 9_000,
        crewMultiplierBp: 12_000,
      }),
    );
    expect(res.effectiveSweepingValue).toBe(1);
  });

  it("bound: 150 × 12_000^6 / 10_000^6 = 447.8976 -> 447 (bigint numerator, safe result)", () => {
    const res = computeEffectiveSweepingValue(
      150,
      multipliers({
        equipmentModeMultiplierBp: 12_000,
        technologyMultiplierBp: 12_000,
        crewMultiplierBp: 12_000,
        readinessMultiplierBp: 12_000,
        damageMultiplierBp: 12_000,
        supportMultiplierBp: 12_000,
      }),
    );
    expect(res.effectiveSweepingValue).toBe(447);
  });

  it("a zero multiplier (unsupported/swept-out factor) makes the whole value 0", () => {
    const res = computeEffectiveSweepingValue(150, multipliers({ supportMultiplierBp: 0 }));
    expect(res.effectiveSweepingValue).toBe(0);
  });

  it("fails a missing / non-integer / negative multiplier (never a silent 10_000)", () => {
    const cases: Array<Partial<EffectiveSweepingMultipliers>> = [
      { equipmentModeMultiplierBp: undefined as never },
      { technologyMultiplierBp: 9_000.5 },
      { crewMultiplierBp: -1 as never },
    ];
    for (const bad of cases) {
      let err: BluewaveError | undefined;
      try {
        computeEffectiveSweepingValue(150, multipliers(bad));
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(MINESWEEPING_SHIP_INELIGIBLE);
    }
  });

  it("fails a non-positive base sweeping value (never silent)", () => {
    for (const bad of [0, -5, 12.5]) {
      let err: BluewaveError | undefined;
      try {
        computeEffectiveSweepingValue(bad, multipliers());
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err!.message).toBe(MINESWEEPING_SHIP_INELIGIBLE);
    }
  });
});

describe("AC-9: mine-type resistance multiplier resolution (reuses shipped §9 literals)", () => {
  it("CONTACT is FLAT 10_000 regardless of capability", () => {
    const def = mineTypeDefinitionById("CONTACT");
    expect(mineTypeSweepResistanceMultiplierBp(def, false)).toBe(10_000);
    expect(mineTypeSweepResistanceMultiplierBp(def, true)).toBe(10_000);
  });

  it("MAGNETIC/ACOUSTIC are capability-gated 7_500 without / 10_000 with", () => {
    const mag = mineTypeDefinitionById("MAGNETIC");
    const aco = mineTypeDefinitionById("ACOUSTIC");
    expect(mineTypeSweepResistanceMultiplierBp(mag, false)).toBe(7_500);
    expect(mineTypeSweepResistanceMultiplierBp(mag, true)).toBe(10_000);
    expect(mineTypeSweepResistanceMultiplierBp(aco, false)).toBe(7_500);
    expect(mineTypeSweepResistanceMultiplierBp(aco, true)).toBe(10_000);
  });

  it("CONTROLLED_DEFENSIVE is FLAT 5_000; SUBMARINE_LAID is FLAT 9_000", () => {
    expect(
      mineTypeSweepResistanceMultiplierBp(mineTypeDefinitionById("CONTROLLED_DEFENSIVE"), false),
    ).toBe(5_000);
    expect(
      mineTypeSweepResistanceMultiplierBp(mineTypeDefinitionById("SUBMARINE_LAID"), false),
    ).toBe(9_000);
  });

  it("SCENARIO_SPECIAL is definition-required -> MINE_SWEEP_RESISTANCE_MISSING", () => {
    let err: BluewaveError | undefined;
    try {
      mineTypeSweepResistanceMultiplierBp(mineTypeDefinitionById("SCENARIO_SPECIAL"), true);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_SWEEP_RESISTANCE_MISSING);
  });
});

describe("AC-9 helper: computeTypeAdjustedSweeping = floor(regional × resistance / 10_000)", () => {
  it("exact integer results", () => {
    expect(computeTypeAdjustedSweeping(SafeInt(1_000), 10_000)).toBe(1_000);
    expect(computeTypeAdjustedSweeping(SafeInt(1_000), 9_000)).toBe(900);
    expect(computeTypeAdjustedSweeping(SafeInt(1_000), 5_000)).toBe(500);
  });

  it("floors once (no per-factor); small products can floor to 0", () => {
    expect(computeTypeAdjustedSweeping(SafeInt(3), 5_000)).toBe(1);
    expect(computeTypeAdjustedSweeping(SafeInt(1), 5_000)).toBe(0);
    expect(computeTypeAdjustedSweeping(SafeInt(1), 9_999)).toBe(0);
  });

  it("handles the 1_000_000 pressure ceiling without precision loss (bigint product)", () => {
    expect(computeTypeAdjustedSweeping(SafeInt(1_000_000), 7_500)).toBe(750_000);
  });

  it("rejects a negative/invalid resistance multiplier (MINE_SWEEP_RESISTANCE_MISSING)", () => {
    let err: BluewaveError | undefined;
    try {
      computeTypeAdjustedSweeping(SafeInt(100), -1);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_SWEEP_RESISTANCE_MISSING);
  });
});
