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

export function computePrecipitationVisibilityMultiplierBp(
  type: PrecipitationType,
  intensityBp: number,
): number {
  if (type === "NONE") return PRECIP_VIS_NONE_BP;

  if (intensityBp <= PRECIP_INTENSITY_LIGHT_MAX_BP) return PRECIP_VIS_LIGHT_BP;
  if (intensityBp <= PRECIP_INTENSITY_MODERATE_MAX_BP) return PRECIP_VIS_MODERATE_BP;
  if (intensityBp <= PRECIP_INTENSITY_HEAVY_MAX_BP) return PRECIP_VIS_HEAVY_BP;
  return PRECIP_VIS_EXTREME_BP;
}
