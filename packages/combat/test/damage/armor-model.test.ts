// INC-2 — Armor model (DESIGN-39 §§16–24). Proves AC-5.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  // Version
  armorPolicyId,
  ARMOR_RULESET_VERSION,
  ARMOR_FORMULA_VERSION,

  // Zone
  ARMOR_ZONE_TYPES,
  ZONE_MAXIMUM_BELT_UM,
  ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM,
  ZONE_MAXIMA_UM,
  getZoneMaximumUm,
  inferArmorZoneType,
  validateArmorThickness,
  ARMOR_ZONE_MAXIMUM_MISSING,
  ARMOR_THICKNESS_LIMIT_EXCEEDED,

  // Manufacturing
  THICK_ARMOR_THRESHOLD_UM,
  THICK_ARMOR_EXCESS_BP,
  manufacturingEffectiveThickness,

  // Quality
  ARMOR_QUALITY_FAMILIES,
  type ArmorQualityFamily,
  ARMOR_QUALITY_MULTIPLIERS_BP,
  lookupArmorQualityMultiplierBp,
  qualityAdjustedThickness,
  ARMOR_QUALITY_MULTIPLIER_MISSING,

  // Obliquity
  obliquityFactorBp,

  // Splinter
  SPLINTER_THRESHOLD_UM,
  SPLINTER_CLASSES,
  splinterProtectionLevel,

  // Penetration outcomes
  PENETRATION_OUTCOMES,
  determinePenetrationOutcome,

  // Contract
  SHIPPED_ARMOR_CONTRACT,
  validateArmorContract,

  // Reason codes
  DAMAGE_STATE_INVARIANT_FAILED,
} from "../../src/damage/index.js";

// §17 — Zone maxima
describe("AC-5: Zone maxima (§17)", () => {
  it("belt maximum is 508_000 µm (20 in)", () => {
    expect(ZONE_MAXIMUM_BELT_UM).toBe(508_000);
  });

  it("turret-face/barbette/conning-tower maximum is 660_400 µm (26 in)", () => {
    expect(ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM).toBe(660_400);
  });

  it("getZoneMaximumUm returns belt max for BELT", () => {
    expect(getZoneMaximumUm("BELT")).toBe(508_000);
  });

  it("getZoneMaximumUm returns 660_400 for TURRET_FACE, BARBETTE, CONNING_TOWER", () => {
    expect(getZoneMaximumUm("TURRET_FACE")).toBe(660_400);
    expect(getZoneMaximumUm("BARBETTE")).toBe(660_400);
    expect(getZoneMaximumUm("CONNING_TOWER")).toBe(660_400);
  });

  it("getZoneMaximumUm throws ARMOR_ZONE_MAXIMUM_MISSING for an unknown zone type", () => {
    let err: BluewaveError | undefined;
    try {
      getZoneMaximumUm("IMAGINARY_ZONE");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(ARMOR_ZONE_MAXIMUM_MISSING);
    expect(err!.context.code).toBe(ARMOR_ZONE_MAXIMUM_MISSING);
    expect(err!.context.zoneType).toBe("IMAGINARY_ZONE");
  });

  it("validateArmorThickness passes for equality (legal)", () => {
    expect(() => validateArmorThickness("BELT", 508_000)).not.toThrow();
    expect(() => validateArmorThickness("TURRET_FACE", 660_400)).not.toThrow();
  });

  it("validateArmorThickness passes for below-maximum thickness", () => {
    expect(() => validateArmorThickness("BELT", 300_000)).not.toThrow();
    expect(() => validateArmorThickness("TURRET_FACE", 400_000)).not.toThrow();
  });

  it("validateArmorThickness throws ARMOR_THICKNESS_LIMIT_EXCEEDED when above max", () => {
    let err: BluewaveError | undefined;
    try {
      validateArmorThickness("BELT", 508_001);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(ARMOR_THICKNESS_LIMIT_EXCEEDED);
    expect(err!.context.code).toBe(ARMOR_THICKNESS_LIMIT_EXCEEDED);
    expect(err!.context.zoneType).toBe("BELT");
    expect(err!.context.thicknessUm).toBe(508_001);
    expect(err!.context.maxUm).toBe(508_000);
  });

  it("validateArmorThickness throws ARMOR_THICKNESS_LIMIT_EXCEEDED for turret-face over max", () => {
    expect(() => validateArmorThickness("TURRET_FACE", 660_401)).toThrow(BluewaveError);
  });

  it("validateArmorThickness throws ARMOR_ZONE_MAXIMUM_MISSING for unknown zone", () => {
    expect(() => validateArmorThickness("BOGUS_ZONE", 100_000)).toThrow(BluewaveError);
  });

  it("ZONE_MAXIMA_UM contains all canonical zone types", () => {
    for (const zone of ARMOR_ZONE_TYPES) {
      expect(ZONE_MAXIMA_UM[zone]).toBeDefined();
    }
  });
});

// §19 — Thick-armor manufacturing
describe("AC-5: Thick-armor manufacturing (§18-19)", () => {
  it("threshold is 304_800 µm (12 in)", () => {
    expect(THICK_ARMOR_THRESHOLD_UM).toBe(304_800);
  });

  it("excess rate is 7_500 bp", () => {
    expect(THICK_ARMOR_EXCESS_BP).toBe(7_500);
  });

  it("12 in (304_800µm) — at threshold, full thickness", () => {
    // thinPortion = 304_800, excess = 0 → 304_800
    expect(manufacturingEffectiveThickness(304_800)).toBe(304_800);
  });

  it("16 in (406_400µm) — discount applied to excess", () => {
    // thinPortion = min(406_400, 304_800) = 304_800
    // excess = max(0, 406_400 - 304_800) = 101_600
    // effective = 304_800 + floor(101_600 * 7500 / 10000)
    //          = 304_800 + floor(76_200) = 304_800 + 76_200 = 381_000
    expect(manufacturingEffectiveThickness(406_400)).toBe(381_000);
  });

  it("20 in (508_000µm) — full belt max, discount applied", () => {
    // thinPortion = min(508_000, 304_800) = 304_800
    // excess = max(0, 508_000 - 304_800) = 203_200
    // effective = 304_800 + floor(203_200 * 7500 / 10000)
    //          = 304_800 + floor(152_400) = 304_800 + 152_400 = 457_200
    expect(manufacturingEffectiveThickness(508_000)).toBe(457_200);
  });

  it("below threshold — no discount, full thickness", () => {
    expect(manufacturingEffectiveThickness(250_000)).toBe(250_000);
    expect(manufacturingEffectiveThickness(100_000)).toBe(100_000);
    expect(manufacturingEffectiveThickness(0)).toBe(0);
  });

  it("just above threshold — partial discount", () => {
    // 5mm above threshold: thinPortion = 304_800, excess = 5_000
    // effective = 304_800 + floor(5000 * 7500 / 10000) = 304_800 + floor(3750) = 308_550
    expect(manufacturingEffectiveThickness(309_800)).toBe(308_550);
  });
});

// §20 — Quality adjustment
describe("AC-5: Armor quality adjustment (§20-21)", () => {
  it("ARMOR_QUALITY_FAMILIES has 5 families in order", () => {
    expect([...ARMOR_QUALITY_FAMILIES]).toEqual([
      "IRON",
      "COMPOUND",
      "HARVEY",
      "KRUPP_KC",
      "POST_KC",
    ]);
  });

  it("quality multipliers: iron=8_000, compound=9_000, Harvey=10_000, Krupp=10_500, post-KC=11_000", () => {
    expect(ARMOR_QUALITY_MULTIPLIERS_BP.IRON).toBe(8_000);
    expect(ARMOR_QUALITY_MULTIPLIERS_BP.COMPOUND).toBe(9_000);
    expect(ARMOR_QUALITY_MULTIPLIERS_BP.HARVEY).toBe(10_000);
    expect(ARMOR_QUALITY_MULTIPLIERS_BP.KRUPP_KC).toBe(10_500);
    expect(ARMOR_QUALITY_MULTIPLIERS_BP.POST_KC).toBe(11_000);
  });

  it("lookupArmorQualityMultiplierBp returns correct values for shipped families", () => {
    expect(lookupArmorQualityMultiplierBp("IRON")).toBe(8_000);
    expect(lookupArmorQualityMultiplierBp("COMPOUND")).toBe(9_000);
    expect(lookupArmorQualityMultiplierBp("HARVEY")).toBe(10_000);
    expect(lookupArmorQualityMultiplierBp("KRUPP_KC")).toBe(10_500);
    expect(lookupArmorQualityMultiplierBp("POST_KC")).toBe(11_000);
  });

  it("lookupArmorQualityMultiplierBp throws ARMOR_QUALITY_MULTIPLIER_MISSING for unknown family", () => {
    let err: BluewaveError | undefined;
    try {
      lookupArmorQualityMultiplierBp("FACE_HARDENED_STEEL_1905");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(ARMOR_QUALITY_MULTIPLIER_MISSING);
    expect(err!.context.code).toBe(ARMOR_QUALITY_MULTIPLIER_MISSING);
    expect(err!.context.family).toBe("FACE_HARDENED_STEEL_1905");
  });

  it("qualityAdjustedThickness: Harvey (10_000 bp) on 304_800µm = 304_800µm (no change)", () => {
    // floor(304_800 * 10_000 / 10_000) = 304_800
    expect(qualityAdjustedThickness(304_800, 10_000)).toBe(304_800);
  });

  it("qualityAdjustedThickness: iron (8_000 bp) on 304_800µm = 243_840µm", () => {
    // floor(304_800 * 8_000 / 10_000) = floor(243_840) = 243_840
    expect(qualityAdjustedThickness(304_800, 8_000)).toBe(243_840);
  });

  it("qualityAdjustedThickness: post-KC (11_000 bp) on 304_800µm = 335_280µm", () => {
    // floor(304_800 * 11_000 / 10_000) = floor(335_280) = 335_280
    expect(qualityAdjustedThickness(304_800, 11_000)).toBe(335_280);
  });

  it("qualityAdjustedThickness: Krupp KC (10_500 bp) on 381_000µm (16in manufactured)", () => {
    // floor(381_000 * 10_500 / 10_000) = floor(400_050) = 400_050
    expect(qualityAdjustedThickness(381_000, 10_500)).toBe(400_050);
  });
});

// §21 — Impact geometry / obliquity
describe("AC-5: Impact geometry / obliquity (§21)", () => {
  it("normal impact (0°) on vertical armor (0° slope) → 10_000 bp", () => {
    expect(obliquityFactorBp(0, 0)).toBe(10_000);
  });

  it("45° impact on 0° slope → ~7_071 bp", () => {
    // cos(45°) ≈ 0.7071, * 10_000 = 7_071
    const factor = obliquityFactorBp(45, 0);
    expect(factor).toBe(7_071);
  });

  it("impact angle fully offset by armor slope → 10_000 bp", () => {
    // net angle = max(0, 10 - 10) = 0°, cos(0) = 1.0
    expect(obliquityFactorBp(10, 10)).toBe(10_000);
  });

  it("negative net angle clamped to 0 → 10_000 bp", () => {
    // net angle = max(0, 10 - 20) = 0°, cos(0) = 1.0
    expect(obliquityFactorBp(10, 20)).toBe(10_000);
  });

  it("60° impact on 0° slope → 5_000 bp", () => {
    // cos(60°) = 0.5, * 10_000 = 5_000
    expect(obliquityFactorBp(60, 0)).toBe(5_000);
  });

  it("90° impact (parallel) → 0 bp", () => {
    // cos(90°) = 0, * 10_000 = 0
    expect(obliquityFactorBp(90, 0)).toBe(0);
  });

  it("factor clamped to [0, 10_000]", () => {
    // Negative cos not possible for [0, 90] range, but test stability
    const factor = obliquityFactorBp(0, 0);
    expect(factor).toBeGreaterThanOrEqual(0);
    expect(factor).toBeLessThanOrEqual(10_000);
  });
});

// §22-23 — Splinter threshold
describe("AC-5: Splinter threshold (§22-23)", () => {
  it("splinter threshold is 50_800 µm (2 in)", () => {
    expect(SPLINTER_THRESHOLD_UM).toBe(50_800);
  });

  it("SPLINTER_CLASSES has 4 classes", () => {
    expect([...SPLINTER_CLASSES]).toEqual(["LIGHT", "MEDIUM", "HEAVY", "EXTREME"]);
  });

  it("≥ 50_800µm (2 in) — protects at least against MEDIUM", () => {
    expect(splinterProtectionLevel(50_800)).toBe("MEDIUM");
    expect(splinterProtectionLevel(60_000)).toBe("MEDIUM");
    expect(splinterProtectionLevel(100_000)).toBe("MEDIUM");
  });

  it("≥ 102_000µm (~4 in) — protects against HEAVY", () => {
    expect(splinterProtectionLevel(102_000)).toBe("HEAVY");
    expect(splinterProtectionLevel(200_000)).toBe("HEAVY");
  });

  it("below 50_800µm — no splinter protection (null)", () => {
    expect(splinterProtectionLevel(50_799)).toBeNull();
    expect(splinterProtectionLevel(25_000)).toBeNull();
    expect(splinterProtectionLevel(0)).toBeNull();
  });
});

// §24 — Penetration outcomes
describe("AC-5: Seven penetration outcomes (§24)", () => {
  it("PENETRATION_OUTCOMES has exactly 7 outcomes", () => {
    expect([...PENETRATION_OUTCOMES]).toEqual([
      "NO_EFFECT",
      "SPLINTER_EFFECT",
      "PARTIAL_PENETRATION",
      "FULL_PENETRATION",
      "PASS_THROUGH",
      "DUD",
      "CRITICAL_PENETRATION",
    ]);
  });

  it("NO_EFFECT: penetration capability below all thresholds", () => {
    const outcome = determinePenetrationOutcome(24, 100, 0, false);
    expect(outcome).toBe("NO_EFFECT");
  });

  it("SPLINTER_EFFECT: penetration between 25% and 50% of resistance", () => {
    // 30 < 100 * 0.5 but >= 100 * 0.25
    const outcome = determinePenetrationOutcome(30, 100, 0, false);
    expect(outcome).toBe("SPLINTER_EFFECT");
  });

  it("PARTIAL_PENETRATION: penetration between 50% and 100% of resistance", () => {
    // 75 >= 100 * 0.5 but < 100
    const outcome = determinePenetrationOutcome(75, 100, 0, false);
    expect(outcome).toBe("PARTIAL_PENETRATION");
  });

  it("FULL_PENETRATION: penetration >= resistance, non-critical zone", () => {
    const outcome = determinePenetrationOutcome(100, 100, 0, false);
    expect(outcome).toBe("FULL_PENETRATION");
  });

  it("FULL_PENETRATION: penetration slightly above resistance", () => {
    // Not > 3x so not PASS_THROUGH
    const outcome = determinePenetrationOutcome(200, 100, 0, false);
    expect(outcome).toBe("FULL_PENETRATION");
  });

  it("PASS_THROUGH: penetration > 3x resistance (overpenetration)", () => {
    const outcome = determinePenetrationOutcome(301, 100, 0, false);
    expect(outcome).toBe("PASS_THROUGH");
  });

  it("CRITICAL_PENETRATION: penetration >= resistance in critical zone", () => {
    const outcome = determinePenetrationOutcome(100, 100, 0, true);
    expect(outcome).toBe("CRITICAL_PENETRATION");
  });

  it("CRITICAL_PENETRATION: penetration > resistance in critical zone (but not >3x)", () => {
    const outcome = determinePenetrationOutcome(250, 100, 0, true);
    expect(outcome).toBe("CRITICAL_PENETRATION");
  });

  it("DUD: impact angle > 70° (ricochet)", () => {
    const outcome = determinePenetrationOutcome(500, 100, 75, false);
    expect(outcome).toBe("DUD");
  });

  it("DUD takes precedence over overpenetration at extreme angle", () => {
    const outcome = determinePenetrationOutcome(1000, 100, 80, false);
    expect(outcome).toBe("DUD");
  });
});

// Contract validation
describe("AC-5: SHIPPED_ARMOR_CONTRACT + validate guard (fail closed)", () => {
  it("ships the armor_v1 policy id", () => {
    expect(armorPolicyId).toBe("armor_v1");
    expect(SHIPPED_ARMOR_CONTRACT.policyId).toBe("armor_v1");
  });

  it("ships the ruleset and formula versions", () => {
    expect(SHIPPED_ARMOR_CONTRACT.rulesetVersion).toBe(ARMOR_RULESET_VERSION);
    expect(SHIPPED_ARMOR_CONTRACT.formulaVersion).toBe(ARMOR_FORMULA_VERSION);
  });

  it("ships zone maxima", () => {
    expect(SHIPPED_ARMOR_CONTRACT.beltMaximumUm).toBe(508_000);
    expect(SHIPPED_ARMOR_CONTRACT.turretFaceBarbetteConningTowerMaximumUm).toBe(660_400);
  });

  it("ships manufacturing constants", () => {
    expect(SHIPPED_ARMOR_CONTRACT.thickArmorThresholdUm).toBe(304_800);
    expect(SHIPPED_ARMOR_CONTRACT.thickArmorExcessBp).toBe(7_500);
  });

  it("ships splinter threshold", () => {
    expect(SHIPPED_ARMOR_CONTRACT.splinterThresholdUm).toBe(50_800);
  });

  it("ships quality families and multipliers", () => {
    expect([...SHIPPED_ARMOR_CONTRACT.qualityFamilies]).toEqual([...ARMOR_QUALITY_FAMILIES]);
    for (const f of ARMOR_QUALITY_FAMILIES) {
      expect(SHIPPED_ARMOR_CONTRACT.qualityMultipliersBp[f]).toBe(ARMOR_QUALITY_MULTIPLIERS_BP[f]);
    }
  });

  it("ships splinter classes and penetration outcomes", () => {
    expect([...SHIPPED_ARMOR_CONTRACT.splinterClasses]).toEqual([...SPLINTER_CLASSES]);
    expect([...SHIPPED_ARMOR_CONTRACT.penetrationOutcomes]).toEqual([...PENETRATION_OUTCOMES]);
  });

  it("validateArmorContract passes for the shipped contract", () => {
    expect(() => validateArmorContract(SHIPPED_ARMOR_CONTRACT)).not.toThrow();
  });

  it("fails closed on null/missing contract", () => {
    expect(() => validateArmorContract(null)).toThrow(BluewaveError);
    expect(() => validateArmorContract(undefined)).toThrow(BluewaveError);
  });

  it("fails closed on mismatched policy id", () => {
    let err: BluewaveError | undefined;
    try {
      validateArmorContract({ ...SHIPPED_ARMOR_CONTRACT, policyId: "armor_v2" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(DAMAGE_STATE_INVARIANT_FAILED);
  });

  it("fails closed on tampered belt max", () => {
    expect(() =>
      validateArmorContract({ ...SHIPPED_ARMOR_CONTRACT, beltMaximumUm: 600_000 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered turret face max", () => {
    expect(() =>
      validateArmorContract({
        ...SHIPPED_ARMOR_CONTRACT,
        turretFaceBarbetteConningTowerMaximumUm: 700_000,
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered thick armor threshold", () => {
    expect(() =>
      validateArmorContract({ ...SHIPPED_ARMOR_CONTRACT, thickArmorThresholdUm: 300_000 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered excess bp", () => {
    expect(() =>
      validateArmorContract({ ...SHIPPED_ARMOR_CONTRACT, thickArmorExcessBp: 8_000 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered splinter threshold", () => {
    expect(() =>
      validateArmorContract({ ...SHIPPED_ARMOR_CONTRACT, splinterThresholdUm: 51_000 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on missing quality family", () => {
    expect(() =>
      validateArmorContract({
        ...SHIPPED_ARMOR_CONTRACT,
        qualityFamilies: [...ARMOR_QUALITY_FAMILIES, "EXTRA" as ArmorQualityFamily],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered quality multiplier", () => {
    expect(() =>
      validateArmorContract({
        ...SHIPPED_ARMOR_CONTRACT,
        qualityMultipliersBp: { ...ARMOR_QUALITY_MULTIPLIERS_BP, IRON: 8_500 },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered splinter classes", () => {
    expect(() =>
      validateArmorContract({
        ...SHIPPED_ARMOR_CONTRACT,
        splinterClasses: ["LIGHT", "MEDIUM", "HEAVY"],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered penetration outcomes", () => {
    expect(() =>
      validateArmorContract({
        ...SHIPPED_ARMOR_CONTRACT,
        penetrationOutcomes: [...PENETRATION_OUTCOMES].slice(0, 3),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered zone maxima", () => {
    expect(() =>
      validateArmorContract({
        ...SHIPPED_ARMOR_CONTRACT,
        zoneMaximaUm: { ...ZONE_MAXIMA_UM, BELT: 500_000 },
      }),
    ).toThrow(BluewaveError);
  });
});

describe("inferArmorZoneType: design armour regions reach combat as zones (ADR-0232)", () => {
  it("turret components map to TURRET_FACE; the folded barbette no longer yields its own zone", () => {
    expect(inferArmorZoneType("TURRET-1")).toBe("TURRET_FACE");
    expect(inferArmorZoneType("BARBETTE-1")).toBe("TURRET_FACE");
  });
  it("keeps the other component prefixes and leaves internals unexposed", () => {
    expect(inferArmorZoneType("CONNING-1")).toBe("CONNING_TOWER");
    expect(inferArmorZoneType("DIRECTOR-2")).toBe("SUPERSTRUCTURE");
    expect(inferArmorZoneType("ENGINE-1")).toBeUndefined();
  });
  it("only ever returns a canonical zone type", () => {
    for (const id of ["TURRET-1", "BARBETTE-1", "CONNING-1", "AA-3", "RANGEFINDER-1"])
      expect(ARMOR_ZONE_TYPES as readonly string[]).toContain(inferArmorZoneType(id));
  });
});
