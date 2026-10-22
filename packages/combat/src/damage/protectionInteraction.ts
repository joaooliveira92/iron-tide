import {
  type ArmorQualityFamily,
  type ArmorZoneType,
  type PenetrationOutcome,
  determinePenetrationOutcome,
  lookupArmorQualityMultiplierBp,
  manufacturingEffectiveThickness,
  obliquityFactorBp,
  qualityAdjustedThickness,
  validateArmorThickness,
} from "./armorModel.js";

export interface ProtectionInput {
  projectileCaliberUm: number;
  projectileVelocityMs: number;
  projectileMass: number;
  hitZoneType: ArmorZoneType;
  armorThicknessUm: number;
  armorQualityFamily: ArmorQualityFamily;
  armorSlopeDeg: number;
  impactAngleDeg: number;
  isCriticalZone: boolean;
}

export interface ProtectionResult {
  effectiveResistanceUm: number;
  penetrationMargin: number;
  outcome: PenetrationOutcome;
  manufacturingEffectiveThicknessUm: number;
  qualityAdjustedThicknessUm: number;
  obliquityFactorBp: number;
}

function computePenetrationCapabilityUm(
  caliberUm: number,
  velocityMs: number,
  _mass: number,
): number {
  return Math.floor((caliberUm * velocityMs) / 1000);
}

export function resolveProtectionInteraction(input: ProtectionInput): ProtectionResult {
  validateArmorThickness(input.hitZoneType, input.armorThicknessUm);

  const manufEffectiveUm = manufacturingEffectiveThickness(input.armorThicknessUm);

  const qualityMultiplierBp = lookupArmorQualityMultiplierBp(input.armorQualityFamily);

  const qualityAdjustedUm = qualityAdjustedThickness(manufEffectiveUm, qualityMultiplierBp);

  const obliquityBp = obliquityFactorBp(input.impactAngleDeg, input.armorSlopeDeg);

  const effectiveResistanceUm = Math.floor((qualityAdjustedUm * obliquityBp) / 10_000);

  const penetrationCapabilityUm = computePenetrationCapabilityUm(
    input.projectileCaliberUm,
    input.projectileVelocityMs,
    input.projectileMass,
  );

  const penetrationMargin = penetrationCapabilityUm - effectiveResistanceUm;

  const outcome = determinePenetrationOutcome(
    penetrationCapabilityUm,
    effectiveResistanceUm,
    input.impactAngleDeg,
    input.isCriticalZone,
  );

  return {
    effectiveResistanceUm,
    penetrationMargin,
    outcome,
    manufacturingEffectiveThicknessUm: manufEffectiveUm,
    qualityAdjustedThicknessUm: qualityAdjustedUm,
    obliquityFactorBp: obliquityBp,
  };
}
