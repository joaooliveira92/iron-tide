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

export const LABEL_FONT = 8;

export const NON_SCALING = { vectorEffect: "non-scaling-stroke" } as const;

export const STATION_STEP_PERMILLE = 100;
