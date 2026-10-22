/**
 * Scale-bar maths for the world map. Distances are measured along the equator
 * (1 degree of longitude = 60 nm), the reference every chart scale bar uses;
 * Miller/equirectangular stretch away from it, which the projection note in the
 * toolbar already tells the player.
 */

import type { PresentationFormat } from "../../lib/presentation-format/index.js";

const NM_PER_DEGREE = 60;

/** Screen pixels per nautical mile, given the SVG's px-per-user-unit and camera zoom. */
export function pixelsPerNauticalMile(
  screenPixelsPerUnit: number,
  cameraScale: number,
  worldWidth: number,
): number {
  return (screenPixelsPerUnit * cameraScale * worldWidth) / (360 * NM_PER_DEGREE);
}

export interface ScaleBar {
  readonly nm: number;
  readonly px: number;
}

/** Longest 1/2/5 x 10^n nm bar that fits within `maxPx`. */
export function niceScaleBar(pxPerNm: number, maxPx: number): ScaleBar {
  if (!(pxPerNm > 0) || !Number.isFinite(pxPerNm)) return { nm: 0, px: 0 };
  const maxNm = maxPx / pxPerNm;
  const exponent = Math.floor(Math.log10(maxNm));
  const base = 10 ** exponent;
  for (const step of [5, 2, 1]) {
    const nm = step * base;
    if (nm <= maxNm) return { nm: Number(nm.toPrecision(12)), px: nm * pxPerNm };
  }
  return { nm: base, px: base * pxPerNm };
}

export function formatNauticalMiles(nm: number, format: PresentationFormat): string {
  if (nm >= 1) return `${format.number(nm, { maximumFractionDigits: 0 })} nm`;
  return `${format.number(Number(nm.toPrecision(2)), { maximumFractionDigits: 2 })} nm`;
}
