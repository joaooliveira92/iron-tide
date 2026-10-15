/**
 * Zoom-aware place names. Each kind of name has a window of zoom levels in
 * which it is shown, and fades and shrinks at the edges of it: the biggest
 * names (continents, countries) lead when zoomed out and give way as smaller
 * ones (seas, then ports) come in. `zoom` is the camera scale relative to the
 * fitted-world scale, so 1 means "the whole world fits" in any panel.
 *
 * This file is presentation only: the geography below is for orientation and
 * is independent of the campaign's nations and areas.
 */

import type { Point } from "./projection.js";

export type LabelKind = "continent" | "country" | "sea" | "port";

export interface LabelTraits {
  /** A large sea area (the ocean basins), as opposed to a strait or gulf. */
  readonly big?: boolean;
  /** A major base, as opposed to a minor one. */
  readonly major?: boolean;
}

export interface LabelPresentation {
  /** Font size in screen pixels. */
  readonly px: number;
  readonly opacity: number;
}

/** Below this a label is dropped rather than drawn faint. */
const MIN_VISIBLE_OPACITY = 0.4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 below `from`, 1 above `to`, linear between. */
function ramp(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** How to draw a label of this kind at this zoom, or null if it is not shown. */
export function labelPresentation(
  kind: LabelKind,
  zoom: number,
  traits: LabelTraits = {},
): LabelPresentation | null {
  let presentation: LabelPresentation;
  switch (kind) {
    case "continent":
      // Only the very top of the zoom range; gone before the countries thin out.
      presentation = {
        px: lerp(19, 14, ramp(zoom, 1, 2)),
        opacity: 1 - ramp(zoom, 1.6, 2.2),
      };
      break;
    case "country":
      presentation = {
        // Shrinks as you close in, but stays (small) until street level so the
        // screen is never anonymous.
        px: lerp(14, 11, ramp(zoom, 2.5, 6)),
        opacity: 1 - ramp(zoom, 30, 45),
      };
      break;
    case "sea":
      if (traits.big === true) {
        // The ocean basins shrink as you close in and are gone at street level.
        presentation = {
          px: lerp(15, 11, ramp(zoom, 3, 8)),
          opacity: 1 - ramp(zoom, 11, 15),
        };
      } else {
        presentation = {
          px: lerp(13, 11, ramp(zoom, 4, 10)),
          opacity: ramp(zoom, 1.8, 2.4),
        };
      }
      break;
    case "port": {
      const from = traits.major === true ? 3 : 6;
      presentation = { px: 12, opacity: ramp(zoom, from, from + 0.6) };
      break;
    }
  }
  // A name caught mid-fade would sit on the map as a ghost until the next
  // zoom, so below this it is simply not shown.
  return presentation.opacity >= MIN_VISIBLE_OPACITY ? presentation : null;
}

/** Higher-priority kinds win a collision (lower number first). */
export const LABEL_RANK: Readonly<Record<LabelKind, number>> = {
  country: 0,
  sea: 1,
  continent: 2,
  port: 3,
};

export interface GeographyLabel {
  readonly name: string;
  /** [longitude, latitude]. */
  readonly at: Point;
}

export const CONTINENTS: readonly GeographyLabel[] = [
  { name: "North America", at: [-102, 48] },
  { name: "South America", at: [-60, -14] },
  { name: "Europe", at: [14, 54] },
  { name: "Africa", at: [20, 4] },
  { name: "Asia", at: [92, 52] },
  { name: "Australia", at: [134, -25] },
  { name: "Antarctica", at: [30, -80] },
];

/** The great powers of the period plus the larger states around them. */
export const COUNTRIES: readonly GeographyLabel[] = [
  { name: "United Kingdom", at: [-2, 53.5] },
  { name: "France", at: [2.5, 46.5] },
  { name: "German Empire", at: [10.5, 51] },
  { name: "Austria-Hungary", at: [19, 47.2] },
  { name: "Italy", at: [12.5, 42.5] },
  { name: "Spain", at: [-3.5, 40] },
  { name: "Portugal", at: [-8, 39.5] },
  { name: "Netherlands", at: [5.3, 52.2] },
  { name: "Russian Empire", at: [60, 60] },
  { name: "Ottoman Empire", at: [37, 38.5] },
  { name: "Persia", at: [54, 32] },
  { name: "British India", at: [78, 22] },
  { name: "Qing China", at: [105, 35] },
  { name: "Japan", at: [138, 36.5] },
  { name: "Siam", at: [101, 15] },
  { name: "United States", at: [-98, 39] },
  { name: "Canada", at: [-100, 58] },
  { name: "Mexico", at: [-102, 24] },
  { name: "Brazil", at: [-52, -10] },
  { name: "Argentina", at: [-65, -35] },
];
