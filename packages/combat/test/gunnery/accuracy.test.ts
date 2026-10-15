import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  resolveAccuracy,
  neutralAccuracyFactors,
  GUNNERY_ACCURACY_DENOMINATOR,
  GUNNERY_ACCURACY_FACTOR_KEYS,
  type GunneryAccuracyFactors,
} from "../../src/gunnery/index.js";
import {
  SHIPPED_GUNNERY_ACCURACY_CONTRACT,
  validateGunneryAccuracyContract,
  gunneryAccuracyPolicyId,
} from "../../src/gunnery/index.js";
import { GUNNERY_ACCURACY_FACTOR_MISSING } from "../../src/gunnery/index.js";

describe("AC-3 accuracy formula exactness (DESIGN-39 §3, INC-2)", () => {
  // All 16 multipliers neutral (10_000) -> the 10_000^16 cancels exactly and the
  // final accuracy equals the base accuracy exactly.
  it("all-neutral factors yield finalAccuracyBp === baseAccuracyBp (exact)", () => {
    expect(resolveAccuracy(neutralAccuracyFactors(7_500)).finalAccuracyBp).toBe(7_500);
    expect(resolveAccuracy(neutralAccuracyFactors(0)).finalAccuracyBp).toBe(0);
    expect(resolveAccuracy(neutralAccuracyFactors(10_000)).finalAccuracyBp).toBe(10_000);
  });

  function factorsWith(
    base: number,
    overrides: Partial<Record<(typeof GUNNERY_ACCURACY_FACTOR_KEYS)[number], number>>,
  ): GunneryAccuracyFactors {
    return { ...neutralAccuracyFactors(base), ...overrides } as GunneryAccuracyFactors;
  }

  // Mixed-multiplier FLOOR-once/exactness case: retaining the exact rational and
  // flooring ONCE at the end gives 370; truncating to a 10_000 division at each
  // multiplier would give only 369 (accumulated loss). This proves the exact
  // integer value is retained through all factors and rounded once.
  // exact = floor(10_000 * 3_333^3 * 10_000^13 / 10_000^16) = floor(3_333^3 / 10_000^2)
  //       = floor(37_025_927_037 / 100_000_000) = floor(370.259...) = 370.
  it("retains the exact rational through all factors and floors once (not per-step)", () => {
    const res = resolveAccuracy(
      factorsWith(10_000, { fireControl: 3_333, crew: 3_333, officer: 3_333 }),
    );
    expect(res.finalAccuracyBp).toBe(370);
    expect(res.rounding.rawFlooredBp).toBe(370);
    expect(res.rounding.mode).toBe("floor");
    // cross-check against the exact bigint rational outlined in the return.
    const exactFloor = Number(BigInt(res.rounding.numerator) / BigInt(res.rounding.denominator));
    expect(res.rounding.rawFlooredBp).toBe(exactFloor);
    expect(GUNNERY_ACCURACY_DENOMINATOR.toString()).toBe(res.rounding.denominator);
  });

  // FLOOR rounding (not nearest): 3*7_500 -> exact 4_218.75 -> floor 4_218 (half-up
  // would be 4_219).
  it("rounds with FLOOR, not nearest/half-up", () => {
    const res = resolveAccuracy(
      factorsWith(10_000, { fireControl: 7_500, crew: 7_500, officer: 7_500 }),
    );
    expect(res.finalAccuracyBp).toBe(4_218);
    expect(res.rounding.rawFlooredBp).toBe(4_218);
  });

  it("clamps at the 10_000 upper bound", () => {
    // one factor above neutral pushes the floored result to 12_000 -> clamp 10_000.
    expect(resolveAccuracy(factorsWith(10_000, { fireControl: 12_000 })).finalAccuracyBp).toBe(
      10_000,
    );
  });

  it("clamps at the 0 lower bound", () => {
    expect(resolveAccuracy(neutralAccuracyFactors(0)).finalAccuracyBp).toBe(0);
    // any factor at 0 makes the exact product 0.
    expect(resolveAccuracy(factorsWith(10_000, { range: 0 })).finalAccuracyBp).toBe(0);
  });

  it("returns the 17 named factors and the floor rounding detail", () => {
    const res = resolveAccuracy(neutralAccuracyFactors(5_000));
    expect(res.factorKeys.length).toBe(16);
    expect(res.factorKeys).toEqual([...GUNNERY_ACCURACY_FACTOR_KEYS]);
    expect(res.factors.baseAccuracyBp).toBe(5_000);
    expect(res.rounding.mode).toBe("floor");
    expect(Number(res.rounding.numerator)).toBeGreaterThanOrEqual(Number(res.rounding.denominator));
    expect(res.finalAccuracyBp).toBe(5_000);
  });
});

describe("AC-3 missing factor -> GUNNERY_ACCURACY_FACTOR_MISSING (never silent fallback)", () => {
  it("fails when a required factor is missing/undefined", () => {
    const factors = neutralAccuracyFactors(10_000) as Record<string, number | undefined>;
    delete factors.range;
    let err: BluewaveError | undefined;
    try {
      resolveAccuracy(factors as unknown as GunneryAccuracyFactors);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(GUNNERY_ACCURACY_FACTOR_MISSING);
    expect(err!.context.code).toBe(GUNNERY_ACCURACY_FACTOR_MISSING);
    expect(err!.context.factorKey).toBe("range");
  });

  it("fails when a factor is explicitly undefined rather than falling back to 10_000", () => {
    const factors = neutralAccuracyFactors(8_000);
    const broken = { ...factors, smoke: undefined } as unknown as GunneryAccuracyFactors;
    let err: BluewaveError | undefined;
    try {
      resolveAccuracy(broken);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.factorKey).toBe("smoke");
  });

  it("fails on a non-integer factor (no implicit rounding)", () => {
    const factors = neutralAccuracyFactors(8_000);
    const broken = { ...factors, glare: 9_500.5 } as unknown as GunneryAccuracyFactors;
    let err: BluewaveError | undefined;
    try {
      resolveAccuracy(broken);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.factorKey).toBe("glare");
  });

  it("resolves once the missing factor is provided", () => {
    const factors = neutralAccuracyFactors(8_000) as unknown as Record<string, unknown>;
    delete factors.range;
    const fixed = { ...factors, range: 10_000 } as unknown as GunneryAccuracyFactors;
    expect(resolveAccuracy(fixed).finalAccuracyBp).toBe(8_000);
  });
});

describe("AC-14 seed: gunnery_accuracy_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and SHIPPED_GUNNERY_ACCURACY_CONTRACT", () => {
    expect(gunneryAccuracyPolicyId).toBe("gunnery_accuracy_v1");
    expect(SHIPPED_GUNNERY_ACCURACY_CONTRACT.policyId).toBe("gunnery_accuracy_v1");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunneryAccuracyContract(SHIPPED_GUNNERY_ACCURACY_CONTRACT)).not.toThrow();
  });

  it("fails closed on a tampered factor manifest", () => {
    let err: BluewaveError | undefined;
    try {
      validateGunneryAccuracyContract({
        ...SHIPPED_GUNNERY_ACCURACY_CONTRACT,
        factorKeys: ["fireControl"],
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
  });

  it("fails closed on a tampered scale exponent / rounding / bounds", () => {
    expect(() =>
      validateGunneryAccuracyContract({
        ...SHIPPED_GUNNERY_ACCURACY_CONTRACT,
        scaleExponent: 15,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateGunneryAccuracyContract({ ...SHIPPED_GUNNERY_ACCURACY_CONTRACT, rounding: "ceil" }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateGunneryAccuracyContract({ ...SHIPPED_GUNNERY_ACCURACY_CONTRACT, finalMaxBp: 9_999 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a missing contract", () => {
    expect(() => validateGunneryAccuracyContract(null)).toThrow(BluewaveError);
    expect(() => validateGunneryAccuracyContract(undefined)).toThrow(BluewaveError);
  });
});
