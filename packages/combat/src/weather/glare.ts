//packages/combat/src/weather/glare.ts
// DESIGN-42 §24 directional glare (INC-4/AC-7): angular separation bands.
// Observer looking toward the sun receives the penalty; cloud cover above 7_500 bp
// disables glare; glare-ineligible areas return neutral 10_000.
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
  /** Bearing from observer to target (degrees 0..359). */
  observerToTargetBearingDeg: number;
  /** Solar bearing (degrees 0..359). */
  solarBearingDeg: number;
  /** Cloud cover in basis points 0..10_000. */
  cloudCoverBp: number;
  /** Whether the area or observer is glare-eligible. */
  glareEligible: boolean;
}

export interface GlareResult {
  /** Basis-point multiplier (0..10_000) for optical spotting/fire-control. */
  glareMultiplierBp: number;
  /** Angular separation used for the glare band. */
  angularSeparationDeg: number;
  /** Whether glare was disabled by cloud cover. */
  cloudDisabled: boolean;
}

/**
 * Compute the optical glare multiplier per DESIGN-42 §24.
 * When glareEligible is false, the observer is not affected by glare → neutral.
 * When cloud cover > 7_500 bp, ordinary glare is disabled → neutral.
 * When the observer-to-target angular separation from the sun is:
 *   < 10°  → 5_000 bp
 *   10 –<20 → 7_500
 *   20 –<30 → 9_000
 *   ≥ 30°  → 10_000
 */
export function computeGlareMultiplierBp(input: GlareInput): GlareResult {
  // Not eligible → no glare.
  if (!input.glareEligible) {
    return {
      glareMultiplierBp: GLARE_NEUTRAL_MULTIPLIER_BP,
      angularSeparationDeg: 0,
      cloudDisabled: false,
    };
  }

  // Cloud cover above threshold disables ordinary glare.
  if (input.cloudCoverBp > GLARE_CLOUD_DISABLE_THRESHOLD_BP) {
    return {
      glareMultiplierBp: GLARE_NEUTRAL_MULTIPLIER_BP,
      angularSeparationDeg: 0,
      cloudDisabled: true,
    };
  }

  // Compute angular separation between observer-to-target bearing and solar bearing.
  const diff = Math.abs(input.observerToTargetBearingDeg - input.solarBearingDeg);
  // Handle wrap-around (e.g., bearing 350° vs 10° → separation 20°).
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
