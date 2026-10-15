import type { NationStyle, VisualEra } from "@bluewave/ship-visual";

/** The manual's national turret styles (p140), named for the legend. */
export const STYLE_NAME: Readonly<Record<NationStyle, string>> = {
  A: "Austro-Hungarian",
  B: "British",
  F: "French",
  G: "German",
  I: "Italian",
  J: "Japanese",
  Q: "Chinese",
  R: "Russian",
  S: "Spanish",
  U: "American",
  X: "universal",
};

const ERA_NAME: Readonly<Record<VisualEra, string>> = {
  VICTORIAN: "Victorian (to 1895)",
  PRE_DREADNOUGHT: "Pre-dreadnought (1896–1905)",
  DREADNOUGHT: "Dreadnought (1906–1935)",
  LATE_DREADNOUGHT: "Late dreadnought (1936 on)",
};

/** A visual era with its year span (ship-visual-era/1). */
export const eraName = (era: VisualEra): string => ERA_NAME[era];
