import { BluewaveError } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  AMMUNITION_TYPES,
  BASE_RELOAD_MS_BY_CALIBER,
  FIRE_MODES,
  GUN_QUALITY_TABLE,
  GUNNERY_ACCURACY_FACTOR_KEYS,
  GUNNERY_CALIBERS,
  GUNNERY_RATE_FACTOR_KEYS,
  GUNNERY_RATE_FACTOR_MISSING,
  GUNNERY_STATE_INVARIANT_FAILED,
  baseReloadMsForCaliber,
  gunneryAccuracyPolicyId,
  gunneryBallisticsPolicyId,
  gunneryGunQualityPolicyId,
  gunneryPolicyId,
  gunneryRatePolicyId,
  SHIPPED_GUN_QUALITY_CONTRACT,
  SHIPPED_GUNNERY_ACCURACY_CONTRACT,
  SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
  SHIPPED_GUNNERY_CONTRACT,
  SHIPPED_GUNNERY_RATE_CONTRACT,
  type AmmunitionType,
  validateGunneryAccuracyContract,
  validateGunneryBallisticsContract,
  validateGunneryContract,
  validateGunneryRateContract,
  validateGunQualityContract,
} from "../../src/gunnery/index.js";

describe("AC-14: gunnery_v1 base contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and SHIPPED_GUNNERY_CONTRACT", () => {
    expect(gunneryPolicyId).toBe("gunnery_v1");
    expect(SHIPPED_GUNNERY_CONTRACT.policyId).toBe("gunnery_v1");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunneryContract(SHIPPED_GUNNERY_CONTRACT)).not.toThrow();
  });

  it("fails closed on a mismatched policy id", () => {
    let err: BluewaveError | undefined;
    try {
      validateGunneryContract({ ...SHIPPED_GUNNERY_CONTRACT, policyId: "x" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(GUNNERY_STATE_INVARIANT_FAILED);
  });

  it("fails closed on a tampered scale constant", () => {
    expect(() =>
      validateGunneryContract({ ...SHIPPED_GUNNERY_CONTRACT, basisPointsPerUnit: 999 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered surface fire-control minimum", () => {
    expect(() =>
      validateGunneryContract({ ...SHIPPED_GUNNERY_CONTRACT, surfaceFireControlMinimumBp: 0 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered ammunition-type set", () => {
    expect(() =>
      validateGunneryContract({
        ...SHIPPED_GUNNERY_CONTRACT,
        ammunitionTypes: ["HE" as AmmunitionType],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateGunneryContract(null)).toThrow(BluewaveError);
    expect(() => validateGunneryContract(undefined)).toThrow(BluewaveError);
  });

  it("fails closed when ruleset/formula versions are drifted", () => {
    expect(() =>
      validateGunneryContract({ ...SHIPPED_GUNNERY_CONTRACT, formulaVersion: "next" }),
    ).toThrow(BluewaveError);
  });

  it("seeds the canonical ammunition types and seven fire modes in the base contract", () => {
    expect([...SHIPPED_GUNNERY_CONTRACT.ammunitionTypes]).toEqual([...AMMUNITION_TYPES]);
    expect([...SHIPPED_GUNNERY_CONTRACT.fireModes]).toEqual([...FIRE_MODES]);
  });
});

describe("AC-14: gunnery_accuracy_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and the 16-factor manifest", () => {
    expect(gunneryAccuracyPolicyId).toBe("gunnery_accuracy_v1");
    expect(SHIPPED_GUNNERY_ACCURACY_CONTRACT.policyId).toBe("gunnery_accuracy_v1");
    expect([...SHIPPED_GUNNERY_ACCURACY_CONTRACT.factorKeys]).toEqual([
      ...GUNNERY_ACCURACY_FACTOR_KEYS,
    ]);
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunneryAccuracyContract(SHIPPED_GUNNERY_ACCURACY_CONTRACT)).not.toThrow();
  });

  it("fails closed on a tampered factor manifest (order or membership)", () => {
    expect(() =>
      validateGunneryAccuracyContract({
        ...SHIPPED_GUNNERY_ACCURACY_CONTRACT,
        factorKeys: [...GUNNERY_ACCURACY_FACTOR_KEYS].reverse(),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered rounding mode or scale exponent", () => {
    expect(() =>
      validateGunneryAccuracyContract({ ...SHIPPED_GUNNERY_ACCURACY_CONTRACT, rounding: "ceil" }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateGunneryAccuracyContract({ ...SHIPPED_GUNNERY_ACCURACY_CONTRACT, scaleExponent: 17 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateGunneryAccuracyContract(null)).toThrow(BluewaveError);
    expect(() => validateGunneryAccuracyContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-14: gunnery_rate_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and the §4 order-1-11 factor manifest", () => {
    expect(gunneryRatePolicyId).toBe("gunnery_rate_v1");
    expect(SHIPPED_GUNNERY_RATE_CONTRACT.policyId).toBe("gunnery_rate_v1");
    expect([...SHIPPED_GUNNERY_RATE_CONTRACT.factorKeys]).toEqual([...GUNNERY_RATE_FACTOR_KEYS]);
    expect(SHIPPED_GUNNERY_RATE_CONTRACT.rounding).toBe("ceil");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunneryRateContract(SHIPPED_GUNNERY_RATE_CONTRACT)).not.toThrow();
  });

  it("fails closed on a tampered factor manifest (§4 order)", () => {
    expect(() =>
      validateGunneryRateContract({
        ...SHIPPED_GUNNERY_RATE_CONTRACT,
        factorKeys: [...GUNNERY_RATE_FACTOR_KEYS].reverse(),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered scale exponent (must be 11)", () => {
    expect(() =>
      validateGunneryRateContract({ ...SHIPPED_GUNNERY_RATE_CONTRACT, scaleExponent: 10 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateGunneryRateContract(null)).toThrow(BluewaveError);
    expect(() => validateGunneryRateContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-14: gun_quality_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id, -3..+2 bounds, and the shipped multiplier table", () => {
    expect(gunneryGunQualityPolicyId).toBe("gun_quality_v1");
    expect(SHIPPED_GUN_QUALITY_CONTRACT.minQuality).toBe(-3);
    expect(SHIPPED_GUN_QUALITY_CONTRACT.maxQuality).toBe(2);
    expect(SHIPPED_GUN_QUALITY_CONTRACT.table).toEqual(GUN_QUALITY_TABLE);
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateGunQualityContract(SHIPPED_GUN_QUALITY_CONTRACT)).not.toThrow();
  });

  it("fails closed on a tampered table entry", () => {
    expect(() =>
      validateGunQualityContract({
        ...SHIPPED_GUN_QUALITY_CONTRACT,
        table: { ...GUN_QUALITY_TABLE, "0": { rangeBp: 1, penetrationBp: 1, rateBp: 1 } },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered bounds", () => {
    expect(() =>
      validateGunQualityContract({ ...SHIPPED_GUN_QUALITY_CONTRACT, minQuality: -4 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateGunQualityContract(null)).toThrow(BluewaveError);
    expect(() => validateGunQualityContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-14: gunnery_ballistics_v1 contract + validate guard (fail closed, INC-5 content deliverable)", () => {
  it("ships the *_v1 policy id and the research-grounded caliber set", () => {
    expect(gunneryBallisticsPolicyId).toBe("gunnery_ballistics_v1");
    expect([...SHIPPED_GUNNERY_BALLISTICS_CONTRACT.calibers]).toEqual([...GUNNERY_CALIBERS]);
    expect(SHIPPED_GUNNERY_BALLISTICS_CONTRACT.baseReloadMsByCaliber).toEqual(
      BASE_RELOAD_MS_BY_CALIBER,
    );
  });

  it("validates the shipped contract without throwing", () => {
    expect(() =>
      validateGunneryBallisticsContract(SHIPPED_GUNNERY_BALLISTICS_CONTRACT),
    ).not.toThrow();
  });

  it("fails closed on a tampered base-reload-ms table entry", () => {
    expect(() =>
      validateGunneryBallisticsContract({
        ...SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
        baseReloadMsByCaliber: { ...BASE_RELOAD_MS_BY_CALIBER, CAL_16IN_406MM: 1 },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered caliber set", () => {
    expect(() =>
      validateGunneryBallisticsContract({
        ...SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
        calibers: [...GUNNERY_CALIBERS].slice(0, 3),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateGunneryBallisticsContract(null)).toThrow(BluewaveError);
    expect(() => validateGunneryBallisticsContract(undefined)).toThrow(BluewaveError);
  });

  it("baseReloadMsForCaliber looks up every shipped caliber's grounded value", () => {
    for (const caliber of GUNNERY_CALIBERS) {
      expect(baseReloadMsForCaliber(caliber)).toBe(BASE_RELOAD_MS_BY_CALIBER[caliber]);
    }
  });

  it("baseReloadMsForCaliber fails closed (GUNNERY_RATE_FACTOR_MISSING) on an unknown caliber, never a silent default", () => {
    let err: BluewaveError | undefined;
    try {
      baseReloadMsForCaliber("CAL_UNKNOWN");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(GUNNERY_RATE_FACTOR_MISSING);
  });

  it("demonstration battery: a 16in-caliber battery's grounded baseReloadMs feeds computeEffectiveReloadMs", async () => {
    const { computeEffectiveReloadMs, neutralRateFactors } =
      await import("../../src/gunnery/rateOfFire.js");
    const baseReloadMs = baseReloadMsForCaliber("CAL_16IN_406MM");
    const resolution = computeEffectiveReloadMs(baseReloadMs, neutralRateFactors());
    // All-neutral factors (10_000 bp each) reproduce the base reload exactly.
    expect(resolution.effectiveReloadMs).toBe(baseReloadMs);
  });
});
