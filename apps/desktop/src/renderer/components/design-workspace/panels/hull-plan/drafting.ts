/**
 * Drafting tokens shared by the plan and profile views, so both read as one drawing set.
 * Stroke widths and dash lengths are CSS pixels (the strokes use `vector-effect: non-scaling-stroke`, so they
 * stay constant when the 640-unit viewBox is scaled to the panel width). Hierarchy, strongest first:
 * hull silhouette, fitted structure and deck edge, datums (waterline), guides (stations, construction lines).
 */
export const STROKE = {
  hull: 1.6,
  structure: 1.1,
  datum: 1,
  guide: 0.6,
} as const;

export const DASH = {
  waterline: "7 3",
  centreline: "9 2 2 2",
  zoneGuide: "3 3",
} as const;

export const OPACITY = {
  deckEdge: 0.55,
  datum: 0.9,
  guide: 0.55,
} as const;

/** Label size in SVG user units (not CSS px): the 640-unit drawing is scaled up to the panel width. */
export const LABEL_FONT = 8;

/** Spread onto an SVG element for the non-scaling stroke behaviour. */
export const NON_SCALING = { vectorEffect: "non-scaling-stroke" } as const;

/** Station spacing of the aligned tick marks on both views, permille of waterline length. */
export const STATION_STEP_PERMILLE = 100;
