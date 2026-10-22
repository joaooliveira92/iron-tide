import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  computeDefensiveStandoff,
  INVALID_MINE_PRESSURE_STATE,
  MINE_DEFENSIVE_STANDOFF_ACTIVE,
  MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS,
  MINE_STANDOFF_MAX_PRESSURE,
  MINE_STANDOFF_NONE_LEVEL,
  mineDefensiveStandoffPolicyId,
  SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
  validateMineDefensiveStandoffContract,
  type DefensiveStandoffResult,
} from "@bluewave/combat/mines";

function resultFor(pressure: number): DefensiveStandoffResult {
  return computeDefensiveStandoff(SafeInt(pressure));
}

describe("AC-11: exact §16 level thresholds", () => {
  const boundaryCases: Array<[number, number | null, number | typeof MINE_STANDOFF_NONE_LEVEL]> = [
    [0, null, "none"],
    [99_999, null, "none"],
    [100_000, 9_000, 1],
    [249_999, 9_000, 1],
    [250_000, 7_500, 2],
    [499_999, 7_500, 2],
    [500_000, 5_000, 3],
    [749_999, 5_000, 3],
    [750_000, 2_500, 4],
    [1_000_000, 2_500, 4],
  ];
  for (const [pressure, utility, level] of boundaryCases) {
    it(`pressure ${pressure} -> level ${level}${utility === null ? "" : `, utility ${utility}bp`}`, () => {
      const res = resultFor(pressure);
      expect(res.level).toBe(level);
      if (utility === null) {
        expect(res.utilityMultiplierBp).toBeNull();
        expect(res.standoffActiveCode).toBeNull();
      } else {
        expect(res.utilityMultiplierBp).toBe(utility);
        expect(res.standoffActiveCode).toBe(MINE_DEFENSIVE_STANDOFF_ACTIVE);
      }
    });
  }

  it("exact shipped thresholds + effect multipliers are the authoritative tables", () => {
    expect(MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS).toEqual([
      {
        level: 1,
        lowerBoundInclusive: 100_000,
        upperBoundInclusive: 249_999,
        utilityMultiplierBp: 9_000,
      },
      {
        level: 2,
        lowerBoundInclusive: 250_000,
        upperBoundInclusive: 499_999,
        utilityMultiplierBp: 7_500,
      },
      {
        level: 3,
        lowerBoundInclusive: 500_000,
        upperBoundInclusive: 749_999,
        utilityMultiplierBp: 5_000,
      },
      {
        level: 4,
        lowerBoundInclusive: 750_000,
        upperBoundInclusive: 1_000_000,
        utilityMultiplierBp: 2_500,
      },
    ]);
  });

  it("every interior level pressure matches exactly one row and is used as correct multiplier", () => {
    expect(resultFor(123_456).utilityMultiplierBp).toBe(9_000);
    expect(resultFor(375_000).utilityMultiplierBp).toBe(7_500);
    expect(resultFor(625_000).utilityMultiplierBp).toBe(5_000);
    expect(resultFor(900_000).utilityMultiplierBp).toBe(2_500);
  });
});

describe("AC-11: no automatic operation cancellation + no consumer wired", () => {
  it("the function is value-only: returns level + multiplier + flag, never mutates or cancels anything", () => {
    const active = resultFor(500_000);
    expect(active.level).toBe(3);
    expect(active).toEqual({
      level: 3,
      utilityMultiplierBp: 5_000,
      standoffActiveCode: MINE_DEFENSIVE_STANDOFF_ACTIVE,
    });
    expect(active.standoffActiveCode).toBe(MINE_DEFENSIVE_STANDOFF_ACTIVE);
    expect(resultFor(500_000)).toEqual(active);
  });
});

describe("AC-11: invalid pressure is rejected fail-closed", () => {
  it("rejects out-of-range and non-safe-integer pressure with INVALID_MINE_PRESSURE_STATE", () => {
    const bad: unknown[] = [-1, 1_000_001, 100_000.5, NaN, undefined, "500000"];
    for (const value of bad) {
      let err: BluewaveError | undefined;
      try {
        computeDefensiveStandoff(value as never);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });

  it("accepts the full closed valid range 0..1_000_000", () => {
    expect(resultFor(0).level).toBe(MINE_STANDOFF_NONE_LEVEL);
    expect(resultFor(MINE_STANDOFF_MAX_PRESSURE).level).toBe(4);
  });
});

describe("AC-11: mine_defensive_standoff_v1 contract + fail-closed guard", () => {
  it("the shipped contract passes its own validation (runs at load, no throw)", () => {
    expect(() =>
      validateMineDefensiveStandoffContract(SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT),
    ).not.toThrow();
    expect(SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT.policyId).toBe(mineDefensiveStandoffPolicyId);
    expect(SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT.mustNotAutoCancelAcceptedOperation).toBe(true);
  });

  it("fail-closed on a wrong policy id / version / basis-point scale", () => {
    const tampered = {
      ...SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
      policyId: "mine_defensive_standoff_v2",
    };
    expect(() => validateMineDefensiveStandoffContract(tampered)).toThrow(
      INVALID_MINE_PRESSURE_STATE,
    );
    expect(() =>
      validateMineDefensiveStandoffContract({
        ...SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
        maxPressure: 999_999,
      }),
    ).toThrow(INVALID_MINE_PRESSURE_STATE);
    expect(() =>
      validateMineDefensiveStandoffContract({
        ...SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
        mustNotAutoCancelAcceptedOperation: false,
      }),
    ).toThrow(INVALID_MINE_PRESSURE_STATE);
  });

  it("fail-closed on a tampered threshold / effect multiplier", () => {
    const levels = SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT.levels.map((l) => ({
      ...l,
      utilityMultiplierBp: l.utilityMultiplierBp === 9_000 ? 9_100 : l.utilityMultiplierBp,
    }));
    expect(() =>
      validateMineDefensiveStandoffContract({
        ...SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
        levels,
      }),
    ).toThrow(INVALID_MINE_PRESSURE_STATE);
    const shifted = SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT.levels.map((l) => ({
      ...l,
      lowerBoundInclusive: l.lowerBoundInclusive + 1,
    }));
    expect(() =>
      validateMineDefensiveStandoffContract({
        ...SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
        levels: shifted,
      }),
    ).toThrow(INVALID_MINE_PRESSURE_STATE);
    expect(() => validateMineDefensiveStandoffContract(null)).toThrow(INVALID_MINE_PRESSURE_STATE);
    expect(() => validateMineDefensiveStandoffContract({})).toThrow(INVALID_MINE_PRESSURE_STATE);
  });
});
