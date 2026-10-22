import {
  GLARE_MULTIPLIER_BELOW_10_DEG_BP,
  GLARE_MULTIPLIER_10_TO_20_DEG_BP,
  GLARE_MULTIPLIER_20_TO_30_DEG_BP,
  GLARE_MULTIPLIER_GE_30_DEG_BP,
  GLARE_CLOUD_DISABLE_THRESHOLD_BP,
  GLARE_NEUTRAL_MULTIPLIER_BP,
  GLARE_ANGLE_BAND_10_DEG,
  GLARE_ANGLE_BAND_20_DEG,
  GLARE_ANGLE_BAND_30_DEG,
} from "./constants.js";

export interface GlareInput {
  observerToTargetBearingDeg: number;
  solarBearingDeg: number;
  cloudCoverBp: number;
  glareEligible: boolean;
}

export interface GlareResult {
  glareMultiplierBp: number;
  angularSeparationDeg: number;
  cloudDisabled: boolean;
}

export function computeGlareMultiplierBp(input: GlareInput): GlareResult {
  if (!input.glareEligible) {
    return {
      glareMultiplierBp: GLARE_NEUTRAL_MULTIPLIER_BP,
      angularSeparationDeg: 0,
      cloudDisabled: false,
    };
  }

  if (input.cloudCoverBp > GLARE_CLOUD_DISABLE_THRESHOLD_BP) {
    return {
      glareMultiplierBp: GLARE_NEUTRAL_MULTIPLIER_BP,
      angularSeparationDeg: 0,
      cloudDisabled: true,
    };
  }

  const diff = Math.abs(input.observerToTargetBearingDeg - input.solarBearingDeg);
  const separation = diff <= 180 ? diff : 360 - diff;

  let multiplierBp: number;
  if (separation < GLARE_ANGLE_BAND_10_DEG) {
    multiplierBp = GLARE_MULTIPLIER_BELOW_10_DEG_BP;
  } else if (separation < GLARE_ANGLE_BAND_20_DEG) {
    multiplierBp = GLARE_MULTIPLIER_10_TO_20_DEG_BP;
  } else if (separation < GLARE_ANGLE_BAND_30_DEG) {
    multiplierBp = GLARE_MULTIPLIER_20_TO_30_DEG_BP;
  } else {
    multiplierBp = GLARE_MULTIPLIER_GE_30_DEG_BP;
  }

  return {
    glareMultiplierBp: multiplierBp,
    angularSeparationDeg: separation,
    cloudDisabled: false,
  };
}
