import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  GUNNERY_RATE_FACTOR_KEYS,
  type GunneryRateFactorKey,
  gunneryRatePolicyId,
  SHIPPED_GUNNERY_RATE_CONTRACT,
  validateGunneryRateContract,
  GUNNERY_STATE_INVARIANT_FAILED,
} from "../../src/gunnery/index.js";
import {
  computeEffectiveReloadMs,
  neutralRateFactors,
  advanceReloadProgress,
  isReloadComplete,
  resetReloadProgress,
  GUNNERY_RATE_DENOMINATOR,
  type GunneryRateFactors,
} from "../../src/gunnery/index.js";
import { GUNNERY_RATE_FACTOR_MISSING } from "../../src/gunnery/index.js";

describe("AC-5 rate-of-fire / reload (DESIGN-39 §4, INC-3)", () => {
  // All 11 multipliers neutral (10_000) -> the 10_000^11 cancels exactly and the
  // effective reload equals the base reload exactly (ceil of an integer).
  it("all-neutral factors (n=11) yield effectiveReloadMs === baseReloadMs exactly", () => {
    for (const base of [1, 1_000, 25_000]) {
      const res = computeEffectiveReloadMs(base, neutralRateFactors());
      expect(res.effectiveReloadMs).toBe(base);
      expect(res.rounding.appliedCount).toBe(11);
      expect(Number(res.rounding.denominator)).toBe(Number(GUNNERY_RATE_DENOMINATOR.toString()));
    }
  });

  // A single non-neutral rate multiplier (30_003, above 1.0 -> faster reload) over
  // an otherwise-neutral manifest reproduces the ticket's exact-fraction remainder
  // 1000 * 10_000 / 3_333 = 3000.3 (the n=1 form is the formula's pedagogical shape;
  // the full 11-factor manifest with factor 30_003 yields the same rational):
  //   numerator = 1000 * 30_003 * 10_000^10, denominator = 10_000^11
  //   ratio = 1000 * 30_003 / 10_000 = 3000.3 -> CEIL 3001 (truncation would be 3000).
  it("CEIL rounds the exact-fraction remainder up (not truncate): 3000.3 -> 3001", () => {
    const factors = neutralRateFactors();
    factors.mount = 30_003;
    const res = computeEffectiveReloadMs(1_000, factors);
    expect(res.effectiveReloadMs).toBe(3_001);
    expect(res.rounding.rawCeiledMs).toBe(3_001);
    // Prove the exact rational retained and rounded ONCE with CEIL: the truncated
    // (bigint integer) division is exactly 3000, the remainder is nonzero (so the
    // rational is not an integer), and CEIL therefore lands on 3001 — truncation
    // (floor) would have produced only 3000.
    const denom = BigInt(res.rounding.denominator);
    const numer = BigInt(res.rounding.numerator);
    const truncated = Number(numer / denom);
    expect(truncated).toBe(3_000);
    expect(numer % denom).not.toBe(0n);
    expect(res.effectiveReloadMs).toBe(truncated + 1);
  });

  // Sub-1.0 multiplier lengthens reload and still CEILs on the remainder:
  // 1000 * 3_333 / 10_000 = 333.3 -> CEIL 334 (truncation 333).
  it("a below-neutral factor lengthens reload and CEILs the remainder (333.3 -> 334)", () => {
    const factors = neutralRateFactors();
    factors.crew = 3_333;
    const res = computeEffectiveReloadMs(1_000, factors);
    expect(res.effectiveReloadMs).toBe(334);
    const denom = BigInt(res.rounding.denominator);
    const numer = BigInt(res.rounding.numerator);
    const truncated = Number(numer / denom);
    expect(truncated).toBe(333);
    expect(numer % denom).not.toBe(0n);
    expect(res.effectiveReloadMs).toBe(truncated + 1);
  });

  it("applies all 11 factors in §4 order and reports the correct count n", () => {
    const factors = neutralRateFactors();
    const res = computeEffectiveReloadMs(1_000, factors);
    expect(res.factorKeys).toEqual([...GUNNERY_RATE_FACTOR_KEYS]);
    expect(res.factorKeys).toEqual([
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
    ]);
    expect(res.rounding.appliedCount).toBe(11);
    expect(res.rounding.mode).toBe("ceil");
  });

  it("the §4 product is commutative (order does not change the result)", () => {
    const a = neutralRateFactors();
    a.mount = 12_000;
    a.autoloader = 9_000;
    const resA = computeEffectiveReloadMs(1_000, a);
    const b = neutralRateFactors();
    b.autoloader = 9_000;
    b.mount = 12_000;
    const resB = computeEffectiveReloadMs(1_000, b);
    expect(resA.effectiveReloadMs).toBe(resB.effectiveReloadMs);
    // but the applied order is the canonical §4 order regardless of insertion order.
    expect(resA.factorKeys).toEqual([...GUNNERY_RATE_FACTOR_KEYS]);
    expect(resB.factorKeys).toEqual([...GUNNERY_RATE_FACTOR_KEYS]);
  });

  it("rejects a non-positive / non-integer baseReloadMs", () => {
    expect(() => computeEffectiveReloadMs(0, neutralRateFactors())).toThrow(
      GUNNERY_RATE_FACTOR_MISSING,
    );
    expect(() => computeEffectiveReloadMs(-5, neutralRateFactors())).toThrow(
      GUNNERY_RATE_FACTOR_MISSING,
    );
    expect(() => computeEffectiveReloadMs(1_000.5, neutralRateFactors())).toThrow(
      GUNNERY_RATE_FACTOR_MISSING,
    );
  });
});

describe("AC-5 missing rate factor -> GUNNERY_RATE_FACTOR_MISSING (never silent fallback)", () => {
  function missing(overrides: Partial<Record<GunneryRateFactorKey, number | undefined>>) {
    const factors = neutralRateFactors() as Record<string, unknown>;
    for (const [k] of Object.entries(overrides)) delete factors[k];
    return { ...factors, ...overrides } as unknown as GunneryRateFactors;
  }

  it("fails when a required factor (crew) is missing/undefined", () => {
    const broken = missing({ crew: undefined });
    let err: BluewaveError | undefined;
    try {
      computeEffectiveReloadMs(1_000, broken);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(GUNNERY_RATE_FACTOR_MISSING);
    expect(err!.context.code).toBe(GUNNERY_RATE_FACTOR_MISSING);
    expect(err!.context.factorKey).toBe("crew");
  });

  it("fails on a non-integer factor (no implicit rounding)", () => {
    const factors = neutralRateFactors();
    const broken = { ...factors, technology: 9_500.5 } as unknown as GunneryRateFactors;
    let err: BluewaveError | undefined;
    try {
      computeEffectiveReloadMs(1_000, broken);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.factorKey).toBe("technology");
  });

  it("resolves once the missing factor is provided", () => {
    const factors = neutralRateFactors();
    factors.technology = 9_500;
    expect(computeEffectiveReloadMs(1_000, factors).effectiveReloadMs).toBe(950);
  });
});

describe("AC-5 reload progress advances in exact ms and fires only at full progress", () => {
  it("advances by exact integer milliseconds", () => {
    let p = advanceReloadProgress(0, 1);
    expect(p).toBe(1);
    p = advanceReloadProgress(p, 10);
    expect(p).toBe(11);
    p = advanceReloadProgress(p, 0);
    expect(p).toBe(11);
  });

  it("rejects non-integer / negative progress and advance", () => {
    expect(() => advanceReloadProgress(0.5, 1)).toThrow(GUNNERY_RATE_FACTOR_MISSING);
    expect(() => advanceReloadProgress(0, -1)).toThrow(GUNNERY_RATE_FACTOR_MISSING);
    expect(() => advanceReloadProgress(-1, 1)).toThrow(GUNNERY_RATE_FACTOR_MISSING);
  });

  it("fires only when progress >= effectiveReloadMs (and not before)", () => {
    const effective = computeEffectiveReloadMs(1_000, neutralRateFactors()).effectiveReloadMs; // 1000
    expect(isReloadComplete(effective - 1, effective)).toBe(false);
    expect(isReloadComplete(effective, effective)).toBe(true);
    expect(isReloadComplete(effective + 1, effective)).toBe(true);
  });

  it("resets progress to 0 after firing", () => {
    expect(resetReloadProgress()).toBe(0);
  });
});

describe("AC-14 seed: gunnery_rate_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and SHIPPED_GUNNERY_RATE_CONTRACT", () => {
    expect(gunneryRatePolicyId).toBe("gunnery_rate_v1");
    expect(SHIPPED_GUNNERY_RATE_CONTRACT.policyId).toBe("gunnery_rate_v1");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunneryRateContract(SHIPPED_GUNNERY_RATE_CONTRACT)).not.toThrow();
  });

  it("fails closed on a tampered factor manifest / scale / rounding", () => {
    expect(() =>
      validateGunneryRateContract({
        ...SHIPPED_GUNNERY_RATE_CONTRACT,
        factorKeys: ["crew" as GunneryRateFactorKey],
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateGunneryRateContract({ ...SHIPPED_GUNNERY_RATE_CONTRACT, scaleExponent: 10 }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateGunneryRateContract({ ...SHIPPED_GUNNERY_RATE_CONTRACT, rounding: "floor" }),
    ).toThrow(BluewaveError);
  });

  it("fails closed with the gunnery invariant code on a missing contract", () => {
    let err: BluewaveError | undefined;
    try {
      validateGunneryRateContract(null);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(GUNNERY_STATE_INVARIANT_FAILED);
  });
});
