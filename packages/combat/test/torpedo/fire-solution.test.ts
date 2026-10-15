// AC-9/AC-10: fire-solution quality (DESIGN-40 §10) — the exact basis-point
// rational retained through all TEN multiplier factors, rounded ONCE with FLOOR
// (never truncated mid-product), clamped to [0, 10_000]. A missing/undefined/
// non-integer factor throws TORPEDO_FIRE_SOLUTION_FACTOR_MISSING — never a
// silent 10_000 fallback. The raw numerator reaches ~10^44 (> Number.MAX_SAFE_
// INTEGER) so the intermediate product is bigint; the floored result is a safe
// integer. AC-10 minimums: kind thresholds + the §24 friendly-danger-sector
// 7_500 bp raise applied to every launch kind.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  computeTorpedoSolutionQuality,
  minimumSolutionQualityBp,
  NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP,
  neutralTorpedoSolutionFactors,
  solutionMeetsMinimum,
  TORPEDO_FIRE_SOLUTION_FACTOR_MISSING,
  TORPEDO_SOLUTION_DENOMINATOR,
  TORPEDO_SOLUTION_FACTOR_KEYS,
  type TorpedoSolutionFactors,
} from "../../src/torpedoes/index.js";

describe("AC-9: the §10 11-factor formula (exact integer rational, one FLOOR)", () => {
  it("fully-neutral factors reproduce the base solution quality exactly", () => {
    const resolution = computeTorpedoSolutionQuality(neutralTorpedoSolutionFactors(6_000));
    expect(resolution.solutionQualityBp).toBe(6_000);
    expect(resolution.factorKeys).toEqual(TORPEDO_SOLUTION_FACTOR_KEYS);
    expect(resolution.rounding.mode).toBe("floor");
  });

  it("a single varied factor scales the base linearly (10_000 * 5_000 / 10_000 = 5_000)", () => {
    const factors = neutralTorpedoSolutionFactors(10_000);
    factors.range = 5_000;
    expect(computeTorpedoSolutionQuality(factors).solutionQualityBp).toBe(5_000);
  });

  it("floors ONCE at the final division — never truncates mid-product", () => {
    // 1_000 * 3_333 / 10_000 = 333.3 -> floor 333
    const factors = neutralTorpedoSolutionFactors(1_000);
    factors.bearing = 3_333;
    expect(computeTorpedoSolutionQuality(factors).solutionQualityBp).toBe(333);
  });

  it("multiple varied factors multiply through the manifest", () => {
    // 10_000 * (5_000 * 6_000) / 10_000^2 = 3_000
    const factors = neutralTorpedoSolutionFactors(10_000);
    factors.range = 5_000;
    factors.targetMotion = 6_000;
    expect(computeTorpedoSolutionQuality(factors).solutionQualityBp).toBe(3_000);
  });

  it("clamps to the [0, 10_000] final range (over-capacity base and zero)", () => {
    // Factors are bounded to [0, 10_000], so the over-capacity path is a base
    // above 10_000: raw 20_000 -> clamped 10_000, diagnostic keeps the raw 20_000.
    const boosted = neutralTorpedoSolutionFactors(20_000);
    const resolution = computeTorpedoSolutionQuality(boosted);
    expect(resolution.solutionQualityBp).toBe(10_000);
    expect(resolution.rounding.rawFlooredBp).toBe(20_000); // unclamped raw value
    expect(computeTorpedoSolutionQuality(neutralTorpedoSolutionFactors(0)).solutionQualityBp).toBe(
      0,
    );
  });

  it("bounds every factor multiplier to [0, 10_000]: 10_000 accepted, 10_001 and -1 rejected", () => {
    const atBoundary = neutralTorpedoSolutionFactors(5_000);
    atBoundary.range = 10_000; // the shipped neutral — exact boundary, accepted
    expect(computeTorpedoSolutionQuality(atBoundary).solutionQualityBp).toBe(5_000);

    const above = neutralTorpedoSolutionFactors(5_000);
    above.range = 10_001;
    let err: BluewaveError | undefined;
    try {
      computeTorpedoSolutionQuality(above);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_FIRE_SOLUTION_FACTOR_MISSING);
    expect(err!.context.factorKey).toBe("range");

    const negative = neutralTorpedoSolutionFactors(5_000);
    negative.damage = -1;
    expect(() => computeTorpedoSolutionQuality(negative)).toThrow(BluewaveError);
  });

  it("saturates the raw diagnostic when an absurd base exceeds MAX_SAFE_INTEGER — the authoritative clamp stays exact", () => {
    // 1e30 passes Number.isInteger but is lossy in a Number: the DIAGNOSTIC
    // saturates to Number.MAX_SAFE_INTEGER while solutionQualityBp clamps to 10_000.
    const absurd = neutralTorpedoSolutionFactors(1e30);
    const resolution = computeTorpedoSolutionQuality(absurd);
    expect(resolution.solutionQualityBp).toBe(10_000);
    expect(resolution.rounding.rawFlooredBp).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("BIGINT boundary: the full-magnitude numerator (10_000^11 = 10^44) is retained exactly", () => {
    // This is the proof that Number cannot hold the intermediate product:
    // 10^44 > Number.MAX_SAFE_INTEGER (~9.0e15) — the formula MUST use bigint.
    const resolution = computeTorpedoSolutionQuality(neutralTorpedoSolutionFactors(10_000));
    expect(resolution.solutionQualityBp).toBe(10_000);
    expect(resolution.rounding.numerator).toBe("1" + "0".repeat(44));
    expect(resolution.rounding.denominator).toBe("1" + "0".repeat(40));
    expect(TORPEDO_SOLUTION_DENOMINATOR).toBe(10_000n ** 10n);
    // the floored raw value is a plain safe integer
    expect(Number.isSafeInteger(resolution.rounding.rawFlooredBp)).toBe(true);
  });

  it("a missing, undefined, or non-integer factor fails with TORPEDO_FIRE_SOLUTION_FACTOR_MISSING", () => {
    const missing = neutralTorpedoSolutionFactors(5_000) as Partial<TorpedoSolutionFactors>;
    delete missing.visibility;
    let err: BluewaveError | undefined;
    try {
      computeTorpedoSolutionQuality(missing as TorpedoSolutionFactors);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_FIRE_SOLUTION_FACTOR_MISSING);
    expect(err!.context.factorKey).toBe("visibility");

    expect(() =>
      computeTorpedoSolutionQuality({
        ...neutralTorpedoSolutionFactors(5_000),
        technology: undefined as never,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeTorpedoSolutionQuality({
        ...neutralTorpedoSolutionFactors(5_000),
        damage: 5_000.5,
      }),
    ).toThrow(BluewaveError);
    expect(() => computeTorpedoSolutionQuality({ ...neutralTorpedoSolutionFactors(-1) })).toThrow(
      BluewaveError,
    );
  });

  it("NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP pins the authored neutral 10_000", () => {
    expect(NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP).toBe(10_000);
    const factors = neutralTorpedoSolutionFactors(5_000);
    for (const key of TORPEDO_SOLUTION_FACTOR_KEYS) {
      expect(factors[key]).toBe(10_000);
    }
  });
});

describe("AC-10: §10 minimums — launch-kind thresholds and the §24 friendly-sector raise", () => {
  it("ships the exact kind thresholds (boundaries inclusive)", () => {
    expect(minimumSolutionQualityBp("AUTOMATED", false)).toBe(5_000);
    expect(minimumSolutionQualityBp("MANUAL_CAPTAIN", false)).toBe(4_000);
    expect(minimumSolutionQualityBp("AREA_DENIAL", false)).toBe(3_000);
    expect(minimumSolutionQualityBp("SPREAD", false)).toBe(3_000);
  });

  it("a friendly in the danger sector raises EVERY kind to the 7_500 bp §24 minimum", () => {
    for (const kind of ["AUTOMATED", "MANUAL_CAPTAIN", "AREA_DENIAL", "SPREAD"] as const) {
      expect(minimumSolutionQualityBp(kind, true)).toBe(7_500);
      expect(solutionMeetsMinimum(7_499, kind, true)).toBe(false);
      expect(solutionMeetsMinimum(7_500, kind, true)).toBe(true);
    }
  });

  it("solutionMeetsMinimum boundaries are inclusive at each threshold", () => {
    expect(solutionMeetsMinimum(5_000, "AUTOMATED", false)).toBe(true);
    expect(solutionMeetsMinimum(4_999, "AUTOMATED", false)).toBe(false);
    expect(solutionMeetsMinimum(4_000, "MANUAL_CAPTAIN", false)).toBe(true);
    expect(solutionMeetsMinimum(3_000, "AREA_DENIAL", false)).toBe(true);
    expect(solutionMeetsMinimum(2_999, "SPREAD", false)).toBe(false);
  });
});
