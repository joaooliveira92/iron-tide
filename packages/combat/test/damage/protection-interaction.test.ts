//packages/combat/test/damage/protection-interaction.test.ts
// INC-3 — Protection interaction (Stage 2). Proves AC-5 integration.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  resolveProtectionInteraction,
  type ProtectionInput,
} from "../../src/damage/protectionInteraction.js";
import {
  ARMOR_THICKNESS_LIMIT_EXCEEDED,
  ARMOR_QUALITY_MULTIPLIER_MISSING,
} from "../../src/damage/reasonCodes.js";

// ---------------------------------------------------------------------------
// Fixtures

/**
 * Baseline armor: 12-inch KRUPP_KC belt at 0° slope, normal impact.
 *   - Thickness: 304_800 µm (12 in)
 *   - Quality: KRUPP_KC (10_500 bp)
 *   - Slope: 0°
 *   - Impact angle: 0°
 *
 * Effective resistance chain:
 *   manufEffective = 304_800 (at threshold, no excess)
 *   qualityAdjusted = floor(304_800 * 10_500 / 10_000) = 320_040
 *   obliquityBp = 10_000 (cos(0) = 1.0)
 *   effectiveResistance = floor(320_040 * 10_000 / 10_000) = 320_040
 */
const BELT_BASELINE: ProtectionInput = {
  projectileCaliberUm: 304_800, // 12-inch
  projectileVelocityMs: 400,
  projectileMass: 400,
  hitZoneType: "BELT",
  armorThicknessUm: 304_800, // 12-inch
  armorQualityFamily: "KRUPP_KC",
  armorSlopeDeg: 0,
  impactAngleDeg: 0,
  isCriticalZone: false,
};

// Penetration capability for baseline: floor(304_800 * 400 / 1000) = 121_920
// Resistance: 320_040
// Outcome: 121_920 < 320_040 * 0.25 = 80_010? No. 121_920 >= 80_010 → SPLINTER_EFFECT

// Let's calibrate. For FULL_PENETRATION we need penCap >= resistance (320_040).
// penCap = caliber * velocity / 1000, so need caliber * velocity / 1000 >= 320_040.
// With caliber = 304_800 (12in): need velocity >= 320_040 * 1000 / 304_800 ≈ 1050 m/s.
// That's very fast. Let me use a thinner armor or bigger caliber.

// Better: use a thin armor for full penetration test.
// armorThicknessUm = 100_000 (4in) Harvey (10_000 bp)
// manufEffective = 100_000 (below threshold)
// qualityAdjusted = floor(100_000 * 10_000 / 10_000) = 100_000
// obliquityBp = 10_000 (normal impact)
// effectiveResistance = 100_000
// Need penCap >= 100_000: caliber * velocity / 1000 >= 100_000
// With caliber = 304_800 (12in): velocity >= 328 m/s
// At 400 m/s: penCap = floor(304_800 * 400 / 1000) = 121_920 ≥ 100_000 → FULL_PENETRATION

const FULL_PEN: ProtectionInput = {
  projectileCaliberUm: 304_800,
  projectileVelocityMs: 400,
  projectileMass: 400,
  hitZoneType: "BELT",
  armorThicknessUm: 100_000,
  armorQualityFamily: "HARVEY",
  armorSlopeDeg: 0,
  impactAngleDeg: 0,
  isCriticalZone: false,
};

// For NO_EFFECT: need penCap < 25% of resistance.
// Thin armor at 100_000µm Harvey → resistance = 100_000
// Need penCap < 25_000: caliber * velocity / 1000 < 25_000
// With caliber = 200_000 (7.9in): velocity < 125 m/s
// At 100 m/s: penCap = floor(200_000 * 100 / 1000) = 20_000 < 25_000 → NO_EFFECT

const NO_EFFECT: ProtectionInput = {
  projectileCaliberUm: 200_000,
  projectileVelocityMs: 100,
  projectileMass: 200,
  hitZoneType: "BELT",
  armorThicknessUm: 100_000,
  armorQualityFamily: "HARVEY",
  armorSlopeDeg: 0,
  impactAngleDeg: 0,
  isCriticalZone: false,
};

// For SPLINTER_EFFECT at boundary: need penCap between 25% and 50% of resistance.
// resistance = 100_000 (4in Harvey at normal)
// Need 25_000 <= penCap < 50_000
// With caliber = 200_000 (7.9in): need 125 m/s <= velocity < 250 m/s
// At 150 m/s: penCap = floor(200_000 * 150 / 1000) = 30_000 → SPLINTER_EFFECT

const SPLINTER: ProtectionInput = {
  projectileCaliberUm: 200_000,
  projectileVelocityMs: 150,
  projectileMass: 200,
  hitZoneType: "BELT",
  armorThicknessUm: 100_000,
  armorQualityFamily: "HARVEY",
  armorSlopeDeg: 0,
  impactAngleDeg: 0,
  isCriticalZone: false,
};

// For DUD: impact angle > 70°. Any projectile, any armor.
const DUD: ProtectionInput = {
  ...FULL_PEN,
  impactAngleDeg: 75, // > 70 → DUD
};

// For CRITICAL_PENETRATION: same as full penetration but on critical zone.
const CRITICAL_PEN: ProtectionInput = {
  ...FULL_PEN,
  hitZoneType: "CONNING_TOWER",
  isCriticalZone: true,
};

// For PASS_THROUGH: penCap > 3 × resistance.
// resistance = 100_000 (4in Harvey at normal)
// Need penCap > 300_000: caliber * velocity / 1000 > 300_000
// With caliber = 400_000 (15.75in): velocity > 750 m/s
// At 800 m/s: penCap = floor(400_000 * 800 / 1000) = 320_000 > 300_000 → PASS_THROUGH

const PASS_THROUGH: ProtectionInput = {
  projectileCaliberUm: 400_000,
  projectileVelocityMs: 800,
  projectileMass: 600,
  hitZoneType: "BELT",
  armorThicknessUm: 100_000,
  armorQualityFamily: "HARVEY",
  armorSlopeDeg: 0,
  impactAngleDeg: 0,
  isCriticalZone: false,
};

// ---------------------------------------------------------------------------
// Tests

describe("INC-3: Protection interaction (AC-5)", () => {
  it("full penetration case (margin > 0)", () => {
    const result = resolveProtectionInteraction(FULL_PEN);
    expect(result.outcome).toBe("FULL_PENETRATION");
    expect(result.penetrationMargin).toBeGreaterThan(0);
    // 121_920 - 100_000 = 21_920
    expect(result.penetrationMargin).toBe(21_920);
    expect(result.effectiveResistanceUm).toBe(100_000);
    expect(result.manufacturingEffectiveThicknessUm).toBe(100_000);
    expect(result.qualityAdjustedThicknessUm).toBe(100_000); // Harvey = 10_000 bp, no change
    expect(result.obliquityFactorBp).toBe(10_000);
  });

  it("no effect case (margin < 0)", () => {
    const result = resolveProtectionInteraction(NO_EFFECT);
    expect(result.outcome).toBe("NO_EFFECT");
    expect(result.penetrationMargin).toBeLessThan(0);
    // penCap = floor(200_000 * 100 / 1000) = 20_000
    // resistance = 100_000
    // margin = 20_000 - 100_000 = -80_000
    expect(result.penetrationMargin).toBe(-80_000);
  });

  it("splinter effect at boundary", () => {
    const result = resolveProtectionInteraction(SPLINTER);
    expect(result.outcome).toBe("SPLINTER_EFFECT");
    // penCap = floor(200_000 * 150 / 1000) = 30_000
    // resistance = 100_000
    // 30_000 >= 100_000 * 0.25 = 25_000 → SPLINTER_EFFECT
    // 30_000 < 100_000 * 0.5 = 50_000 → not PARTIAL_PENETRATION
    expect(result.penetrationMargin).toBe(-70_000);
  });

  it("DUD at extreme obliquity > 70°", () => {
    const result = resolveProtectionInteraction(DUD);
    expect(result.outcome).toBe("DUD");
    // margin still computed based on resistance
    expect(result.penetrationMargin).toBeGreaterThan(0); // Same projectile as FULL_PEN
  });

  it("critical penetration on critical zone", () => {
    const result = resolveProtectionInteraction(CRITICAL_PEN);
    expect(result.outcome).toBe("CRITICAL_PENETRATION");
    expect(result.penetrationMargin).toBeGreaterThan(0);
  });

  it("pass-through overpenetration (>3x resistance)", () => {
    const result = resolveProtectionInteraction(PASS_THROUGH);
    expect(result.outcome).toBe("PASS_THROUGH");
    // penCap = floor(400_000 * 800 / 1000) = 320_000
    // resistance = 100_000 (4in Harvey at normal)
    // 320_000 > 300_000 (3x) → PASS_THROUGH
    expect(result.penetrationMargin).toBeGreaterThan(0);
    expect(result.penetrationMargin).toBe(220_000);
  });

  it("throws ARMOR_THICKNESS_LIMIT_EXCEEDED for armor above zone max", () => {
    const input: ProtectionInput = {
      ...BELT_BASELINE,
      armorThicknessUm: 700_000, // Exceeds belt max of 508_000
    };

    let err: BluewaveError | undefined;
    try {
      resolveProtectionInteraction(input);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(ARMOR_THICKNESS_LIMIT_EXCEEDED);
  });

  it("throws ARMOR_QUALITY_MULTIPLIER_MISSING for unknown quality family", () => {
    const input: ProtectionInput = {
      ...BELT_BASELINE,
      armorQualityFamily: "TITANIUM" as "POST_KC",
    };

    let err: BluewaveError | undefined;
    try {
      resolveProtectionInteraction(input);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(ARMOR_QUALITY_MULTIPLIER_MISSING);
  });

  it("quality-adjusted thickness affects effective resistance", () => {
    // Same armor but with IRON (8_000 bp) instead of KRUPP_KC (10_500 bp)
    // resistance = floor(100_000 * 8_000 / 10_000) = 80_000 (vs 100_000 for Harvey)
    const input: ProtectionInput = {
      ...FULL_PEN,
      armorQualityFamily: "IRON",
    };
    const result = resolveProtectionInteraction(input);
    expect(result.qualityAdjustedThicknessUm).toBe(80_000);
    expect(result.effectiveResistanceUm).toBe(80_000);
    // penCap = 121_920 vs resistance 80_000 → still FULL_PENETRATION
    expect(result.outcome).toBe("FULL_PENETRATION");
    expect(result.penetrationMargin).toBe(41_920);
  });

  it("obliquity reduces effective resistance", () => {
    // 45° impact on 0° slope → cos(45°) = ~0.7071 → obliquityBp = 7_071
    // effectiveResistance = floor(100_000 * 7_071 / 10_000) = 70_710
    const input: ProtectionInput = {
      ...FULL_PEN,
      impactAngleDeg: 45,
    };
    const result = resolveProtectionInteraction(input);
    expect(result.obliquityFactorBp).toBe(7_071);
    expect(result.effectiveResistanceUm).toBe(70_710);
    // penCap = 121_920 vs resistance 70_710 → margin = 51_210
    expect(result.penetrationMargin).toBe(51_210);
    expect(result.outcome).toBe("FULL_PENETRATION");
  });

  it("manufacturing discount applied to thick armor", () => {
    // 20-inch belt (508_000 µm) KRUPP_KC at normal impact
    // manufEffective = 304_800 + floor(203_200 * 7_500 / 10_000) = 304_800 + 152_400 = 457_200
    // qualityAdjusted = floor(457_200 * 10_500 / 10_000) = 480_060
    // effectiveResistance = 480_060
    const input: ProtectionInput = {
      projectileCaliberUm: 500_000,
      projectileVelocityMs: 600,
      projectileMass: 800,
      hitZoneType: "BELT",
      armorThicknessUm: 508_000, // 20-inch belt max
      armorQualityFamily: "KRUPP_KC",
      armorSlopeDeg: 0,
      impactAngleDeg: 0,
      isCriticalZone: false,
    };
    const result = resolveProtectionInteraction(input);
    expect(result.manufacturingEffectiveThicknessUm).toBe(457_200);
    expect(result.qualityAdjustedThicknessUm).toBe(480_060);
    expect(result.effectiveResistanceUm).toBe(480_060);
    // penCap = floor(500_000 * 600 / 1000) = 300_000
    // margin = 300_000 - 480_060 = -180_060
    // 300_000 >= 480_060 * 0.5 = 240_030 → PARTIAL_PENETRATION
    // 300_000 < 480_060 → not full
    expect(result.penetrationMargin).toBe(-180_060);
    expect(result.outcome).toBe("PARTIAL_PENETRATION");
  });
});
