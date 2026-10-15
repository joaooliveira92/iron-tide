import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  GUN_QUALITY_TABLE,
  GUN_QUALITY_MIN,
  GUN_QUALITY_MAX,
  gunneryGunQualityPolicyId,
  SHIPPED_GUN_QUALITY_CONTRACT,
  validateGunQualityContract,
  GUNNERY_STATE_INVARIANT_FAILED,
} from "../../src/gunnery/index.js";
import {
  gunQualityMultipliers,
  gunQualityRateMultiplierBp,
  computeEffectiveReloadMs,
  neutralRateFactors,
  type GunneryRateFactors,
} from "../../src/gunnery/index.js";
import { GUN_QUALITY_OUT_OF_RANGE } from "../../src/gunnery/index.js";

describe("AC-6 gun quality (DESIGN-39 §5, INC-3)", () => {
  // Table exactness: all 6 qualities x 3 shipped basis-point multipliers.
  it("ships the exact §5 table for every quality -3..+2 (18 values)", () => {
    expect(GUN_QUALITY_MIN).toBe(-3);
    expect(GUN_QUALITY_MAX).toBe(2);
    const expected: Record<string, [number, number, number]> = {
      "-3": [8_500, 8_500, 8_500],
      "-2": [9_000, 9_000, 9_000],
      "-1": [9_500, 9_500, 9_500],
      "0": [10_000, 10_000, 10_000],
      "1": [10_500, 10_500, 10_500],
      "2": [11_000, 11_000, 11_000],
    };
    // The table's key SET covers exactly all six canonical qualities (-3..+2).
    // Object integer-key ordering is not canonical, so compare the sorted set.
    expect(Object.keys(GUN_QUALITY_TABLE).sort()).toEqual(["-3", "-2", "-1", "0", "1", "2"].sort());
    for (let q = GUN_QUALITY_MIN; q <= GUN_QUALITY_MAX; q++) {
      const m = gunQualityMultipliers(q);
      expect([m.rangeBp, m.penetrationBp, m.rateBp]).toEqual(expected[String(q)]);
      expect([m.rangeBp, m.penetrationBp, m.rateBp]).toEqual([
        GUN_QUALITY_TABLE[String(q) as keyof typeof GUN_QUALITY_TABLE].rangeBp,
        GUN_QUALITY_TABLE[String(q) as keyof typeof GUN_QUALITY_TABLE].penetrationBp,
        GUN_QUALITY_TABLE[String(q) as keyof typeof GUN_QUALITY_TABLE].rateBp,
      ]);
    }
  });

  it("bounds: quality -4 and +3 are rejected with GUN_QUALITY_OUT_OF_RANGE", () => {
    for (const q of [-4, 3, -100, 100]) {
      let err: BluewaveError | undefined;
      try {
        gunQualityMultipliers(q);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(GUN_QUALITY_OUT_OF_RANGE);
      expect(err!.context.code).toBe(GUN_QUALITY_OUT_OF_RANGE);
      expect(err!.context.quality).toBe(q);
    }
  });

  it("bounds: non-integer quality is rejected", () => {
    expect(() => gunQualityMultipliers(0.5)).toThrow(GUN_QUALITY_OUT_OF_RANGE);
  });

  it("the no-rate-effect declaration omits the rate multiplier from the §4 product", () => {
    // With quality affecting rate at -3 (rate 8_500), reload lengthens to
    // ceil(1000 * 8500 / 10_000) = 850.
    const withQuality = neutralRateFactors();
    withQuality.gunQuality = gunQualityRateMultiplierBp(-3); // 8_500
    expect(computeEffectiveReloadMs(1_000, withQuality).effectiveReloadMs).toBe(850);

    // Declaring that quality does NOT affect rate of fire omits the gun-quality
    // factor entirely: n drops to 10 and the all-neutral result equals base exactly.
    const withoutQuality = neutralRateFactors() as GunneryRateFactors & {
      gunQuality?: number;
    };
    delete withoutQuality.gunQuality;
    const resNoQuality = computeEffectiveReloadMs(1_000, withoutQuality as GunneryRateFactors);
    expect(resNoQuality.effectiveReloadMs).toBe(1_000);
    expect(resNoQuality.rounding.appliedCount).toBe(10);
    expect(resNoQuality.factorKeys).not.toContain("gunQuality");
  });

  it("quality feeds the §4 rate product via computeEffectiveReloadMs with the correct multiplier", () => {
    for (const q of [GUN_QUALITY_MIN, -1, 0, 1, GUN_QUALITY_MAX]) {
      const factors = neutralRateFactors();
      factors.gunQuality = gunQualityMultipliers(q).rateBp;
      const res = computeEffectiveReloadMs(1_000, factors);
      const ratio = (1_000 * gunQualityMultipliers(q).rateBp) / 10_000;
      expect(res.effectiveReloadMs).toBe(Math.ceil(ratio));
    }
  });
});

describe("AC-14 seed: gun_quality_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and SHIPPED_GUN_QUALITY_CONTRACT", () => {
    expect(gunneryGunQualityPolicyId).toBe("gun_quality_v1");
    expect(SHIPPED_GUN_QUALITY_CONTRACT.policyId).toBe("gun_quality_v1");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunQualityContract(SHIPPED_GUN_QUALITY_CONTRACT)).not.toThrow();
  });

  it("fails closed on a tampered table value", () => {
    let err: BluewaveError | undefined;
    try {
      validateGunQualityContract({
        ...SHIPPED_GUN_QUALITY_CONTRACT,
        table: {
          ...SHIPPED_GUN_QUALITY_CONTRACT.table,
          "0": { rangeBp: 9_999, penetrationBp: 10_000, rateBp: 10_000 },
        },
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(GUNNERY_STATE_INVARIANT_FAILED);
  });

  it("fails closed on a tampered bound", () => {
    expect(() =>
      validateGunQualityContract({ ...SHIPPED_GUN_QUALITY_CONTRACT, minQuality: -4 }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateGunQualityContract({ ...SHIPPED_GUN_QUALITY_CONTRACT, maxQuality: 3 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a missing contract", () => {
    expect(() => validateGunQualityContract(null)).toThrow(BluewaveError);
    expect(() => validateGunQualityContract(undefined)).toThrow(BluewaveError);
  });
});
