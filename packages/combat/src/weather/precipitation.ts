// DESIGN-42 §26 precipitation visibility multipliers (INC-4/AC-9). Intensity
// level classification (none/light/moderate/heavy/extreme) maps to explicit
// bp multipliers. When precipitation type is NONE, the multiplier is always
// 10_000 regardless of the intensity-bp field.
import {
  type PrecipitationType,
  PRECIP_VIS_NONE_BP,
  PRECIP_VIS_LIGHT_BP,
  PRECIP_VIS_MODERATE_BP,
  PRECIP_VIS_HEAVY_BP,
  PRECIP_VIS_EXTREME_BP,
  PRECIP_INTENSITY_LIGHT_MAX_BP,
  PRECIP_INTENSITY_MODERATE_MAX_BP,
  PRECIP_INTENSITY_HEAVY_MAX_BP,
} from "./constants.js";

/**
 * Classify precipitation intensity-bp into a canonical level/band and return
 * the corresponding optical visibility multiplier (DESIGN-42 §26).
 *
 * Bands: none=0 bp, light=1..2_499, moderate=2_500..4_999,
 * heavy=5_000..7_499, extreme=7_500..10_000.
 *
 * When type is NONE the return is always 10_000 (independent of the bp value).
 *
 * @param type Precipitation type.
 * @param intensityBp Intensity in basis points 0..10_000.
 * @returns Basis-point visibility multiplier.
 */
export function computePrecipitationVisibilityMultiplierBp(
  type: PrecipitationType,
  intensityBp: number,
): number {
  // NONE type → no precipitation effect regardless of the bp value.
  if (type === "NONE") return PRECIP_VIS_NONE_BP;

  // Classify intensity into bands.
  if (intensityBp <= PRECIP_INTENSITY_LIGHT_MAX_BP) return PRECIP_VIS_LIGHT_BP;
  if (intensityBp <= PRECIP_INTENSITY_MODERATE_MAX_BP) return PRECIP_VIS_MODERATE_BP;
  if (intensityBp <= PRECIP_INTENSITY_HEAVY_MAX_BP) return PRECIP_VIS_HEAVY_BP;
  return PRECIP_VIS_EXTREME_BP;
}
