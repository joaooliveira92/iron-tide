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

const BELT_BASELINE: ProtectionInput = {
  projectileCaliberUm: 304_800,
  projectileVelocityMs: 400,
  projectileMass: 400,
  hitZoneType: "BELT",
  armorThicknessUm: 304_800,
  armorQualityFamily: "KRUPP_KC",
  armorSlopeDeg: 0,
  impactAngleDeg: 0,
  isCriticalZone: false,
};

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

const DUD: ProtectionInput = {
  ...FULL_PEN,
  impactAngleDeg: 75,
};

const CRITICAL_PEN: ProtectionInput = {
  ...FULL_PEN,
  hitZoneType: "CONNING_TOWER",
  isCriticalZone: true,
};

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

describe("INC-3: Protection interaction (AC-5)", () => {
  it("full penetration case (margin > 0)", () => {
    const result = resolveProtectionInteraction(FULL_PEN);
    expect(result.outcome).toBe("FULL_PENETRATION");
    expect(result.penetrationMargin).toBeGreaterThan(0);
    expect(result.penetrationMargin).toBe(21_920);
    expect(result.effectiveResistanceUm).toBe(100_000);
    expect(result.manufacturingEffectiveThicknessUm).toBe(100_000);
    expect(result.qualityAdjustedThicknessUm).toBe(100_000);
    expect(result.obliquityFactorBp).toBe(10_000);
  });

  it("no effect case (margin < 0)", () => {
    const result = resolveProtectionInteraction(NO_EFFECT);
    expect(result.outcome).toBe("NO_EFFECT");
    expect(result.penetrationMargin).toBeLessThan(0);
    expect(result.penetrationMargin).toBe(-80_000);
  });

  it("splinter effect at boundary", () => {
    const result = resolveProtectionInteraction(SPLINTER);
    expect(result.outcome).toBe("SPLINTER_EFFECT");
    expect(result.penetrationMargin).toBe(-70_000);
  });

  it("DUD at extreme obliquity > 70°", () => {
    const result = resolveProtectionInteraction(DUD);
    expect(result.outcome).toBe("DUD");
    expect(result.penetrationMargin).toBeGreaterThan(0);
  });

  it("critical penetration on critical zone", () => {
    const result = resolveProtectionInteraction(CRITICAL_PEN);
    expect(result.outcome).toBe("CRITICAL_PENETRATION");
    expect(result.penetrationMargin).toBeGreaterThan(0);
  });

  it("pass-through overpenetration (>3x resistance)", () => {
    const result = resolveProtectionInteraction(PASS_THROUGH);
    expect(result.outcome).toBe("PASS_THROUGH");
    expect(result.penetrationMargin).toBeGreaterThan(0);
    expect(result.penetrationMargin).toBe(220_000);
  });

  it("throws ARMOR_THICKNESS_LIMIT_EXCEEDED for armor above zone max", () => {
    const input: ProtectionInput = {
      ...BELT_BASELINE,
      armorThicknessUm: 700_000,
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
    const input: ProtectionInput = {
      ...FULL_PEN,
      armorQualityFamily: "IRON",
    };
    const result = resolveProtectionInteraction(input);
    expect(result.qualityAdjustedThicknessUm).toBe(80_000);
    expect(result.effectiveResistanceUm).toBe(80_000);
    expect(result.outcome).toBe("FULL_PENETRATION");
    expect(result.penetrationMargin).toBe(41_920);
  });

  it("obliquity reduces effective resistance", () => {
    const input: ProtectionInput = {
      ...FULL_PEN,
      impactAngleDeg: 45,
    };
    const result = resolveProtectionInteraction(input);
    expect(result.obliquityFactorBp).toBe(7_071);
    expect(result.effectiveResistanceUm).toBe(70_710);
    expect(result.penetrationMargin).toBe(51_210);
    expect(result.outcome).toBe("FULL_PENETRATION");
  });

  it("manufacturing discount applied to thick armor", () => {
    const input: ProtectionInput = {
      projectileCaliberUm: 500_000,
      projectileVelocityMs: 600,
      projectileMass: 800,
      hitZoneType: "BELT",
      armorThicknessUm: 508_000,
      armorQualityFamily: "KRUPP_KC",
      armorSlopeDeg: 0,
      impactAngleDeg: 0,
      isCriticalZone: false,
    };
    const result = resolveProtectionInteraction(input);
    expect(result.manufacturingEffectiveThicknessUm).toBe(457_200);
    expect(result.qualityAdjustedThicknessUm).toBe(480_060);
    expect(result.effectiveResistanceUm).toBe(480_060);
    expect(result.penetrationMargin).toBe(-180_060);
    expect(result.outcome).toBe("PARTIAL_PENETRATION");
  });
});
