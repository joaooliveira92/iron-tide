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

export function computeFogVisibilityMultiplierBp(fogMistDensityBp: number): number {
  if (fogMistDensityBp < FOG_VIS_BAND_LIGHT_MIN_BP) {
    return FOG_VIS_BAND_NONE_BP;
  }
  if (fogMistDensityBp <= FOG_VIS_BAND_LIGHT_MAX_BP) {
    return FOG_VIS_BAND_LIGHT_BP;
  }
  if (fogMistDensityBp <= FOG_VIS_BAND_MODERATE_MAX_BP) {
    return FOG_VIS_BAND_MODERATE_BP;
  }
  if (fogMistDensityBp <= FOG_VIS_BAND_HEAVY_MAX_BP) {
    return FOG_VIS_BAND_HEAVY_BP;
  }
  return FOG_VIS_BAND_EXTREME_BP;
}
