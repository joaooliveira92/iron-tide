import type { PresentationFormat } from "../../lib/presentation-format/index.js";

export const TACTICAL_MIN_M_PER_PX = 50;
export const TACTICAL_MAX_M_PER_PX = 1600;

export const SYMBOL_BAND_MIN_M_PER_PX = 800;
export const DETAIL_BAND_MAX_M_PER_PX = 100;

export type TacticalLodBand = "symbols" | "hulls" | "detail";

export function clampMetersPerPixel(metersPerPixel: number): number {
  if (!Number.isFinite(metersPerPixel)) return TACTICAL_MAX_M_PER_PX;
  return Math.min(TACTICAL_MAX_M_PER_PX, Math.max(TACTICAL_MIN_M_PER_PX, metersPerPixel));
}

export function zoomMetersPerPixel(current: number, factor: number): number {
  return clampMetersPerPixel(current / factor);
}

export function lodBandFor(metersPerPixel: number): TacticalLodBand {
  if (metersPerPixel >= SYMBOL_BAND_MIN_M_PER_PX) return "symbols";
  if (metersPerPixel <= DETAIL_BAND_MAX_M_PER_PX) return "detail";
  return "hulls";
}

export function formatScale(metersPerPixel: number, format: PresentationFormat): string {
  return `1 px = ${format.number(Math.round(metersPerPixel), { maximumFractionDigits: 0 })} m`;
}
