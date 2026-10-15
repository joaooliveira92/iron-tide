// DESIGN-42 §25 fog and mist visibility multipliers (INC-4/AC-8). Density →
// visibility multiplier bands; affects optical observation and LOS signaling.
// Radar uses its own explicit weather effects (deferred).
import {
  FOG_VIS_BAND_NONE_BP,
  FOG_VIS_BAND_LIGHT_MIN_BP,
  FOG_VIS_BAND_LIGHT_MAX_BP,
  FOG_VIS_BAND_LIGHT_BP,
  FOG_VIS_BAND_MODERATE_MAX_BP,
  FOG_VIS_BAND_MODERATE_BP,
  FOG_VIS_BAND_HEAVY_MAX_BP,
  FOG_VIS_BAND_HEAVY_BP,
  FOG_VIS_BAND_EXTREME_BP,
} from "./constants.js";

/**
 * Compute the optical visibility multiplier from fog/mist density (DESIGN-42 §25).
 * Density 0..999 → 10_000 bp; 1_000..2_499 → 8_500; 2_500..4_999 → 6_000;
 * 5_000..7_499 → 3_500; 7_500..10_000 → 1_500.
 * @param fogMistDensityBp Fog or mist density in basis points 0..10_000.
 * @returns Basis-point multiplier for the visibility formula.
 */
export function computeFogVisibilityMultiplierBp(fogMistDensityBp: number): number {
  if (fogMistDensityBp < FOG_VIS_BAND_LIGHT_MIN_BP) {
    return FOG_VIS_BAND_NONE_BP; // 10_000 — no fog effect
  }
  if (fogMistDensityBp <= FOG_VIS_BAND_LIGHT_MAX_BP) {
    return FOG_VIS_BAND_LIGHT_BP; // 8_500
  }
  if (fogMistDensityBp <= FOG_VIS_BAND_MODERATE_MAX_BP) {
    return FOG_VIS_BAND_MODERATE_BP; // 6_000
  }
  if (fogMistDensityBp <= FOG_VIS_BAND_HEAVY_MAX_BP) {
    return FOG_VIS_BAND_HEAVY_BP; // 3_500
  }
  return FOG_VIS_BAND_EXTREME_BP; // 1_500
}
