/**
 * Tactical battle-map scale model (spec rtw3-parity-ux-overhaul, M-5/M-6).
 * Limits mirror the original game: 1 px = 1,600 m fully zoomed out,
 * 1 px = 50 m fully zoomed in (a 32x range). Pure — the camera keeps the
 * live value in a ref; only the LOD band is allowed into React state (M-7).
 */

export const TACTICAL_MIN_M_PER_PX = 50;
export const TACTICAL_MAX_M_PER_PX = 1600;

/** At or above this, draw NATO-style symbols, scouting lines, threat vectors. */
export const SYMBOL_BAND_MIN_M_PER_PX = 800;
/** At or below this, draw silhouettes, firing arcs, per-turret damage. */
export const DETAIL_BAND_MAX_M_PER_PX = 100;

export type TacticalLodBand = "symbols" | "hulls" | "detail";

export function clampMetersPerPixel(metersPerPixel: number): number {
  if (!Number.isFinite(metersPerPixel)) return TACTICAL_MAX_M_PER_PX;
  return Math.min(TACTICAL_MAX_M_PER_PX, Math.max(TACTICAL_MIN_M_PER_PX, metersPerPixel));
}

/** `factor` > 1 zooms in (fewer metres per pixel); < 1 zooms out. */
export function zoomMetersPerPixel(current: number, factor: number): number {
  return clampMetersPerPixel(current / factor);
}

export function lodBandFor(metersPerPixel: number): TacticalLodBand {
  if (metersPerPixel >= SYMBOL_BAND_MIN_M_PER_PX) return "symbols";
  if (metersPerPixel <= DETAIL_BAND_MAX_M_PER_PX) return "detail";
  return "hulls";
}

export function formatScale(metersPerPixel: number): string {
  return `1 px = ${Math.round(metersPerPixel).toLocaleString("en-US")} m`;
}
