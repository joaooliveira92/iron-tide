export const PhaseResource = {
  ALL: "all",
  TREASURY: "treasury",
  FLEETS: "fleets",
  CONSTRUCTIONS: "constructions",
  RESEARCH: "research",
  WARS: "wars",
  POLITICS: "politics",
  NATIONS: "nations",
  STRATEGIC_WEATHER: "strategicWeather",
  DESIGNS: "designs",
} as const;

export interface PhaseFootprint {
  readonly reads: string[];
  readonly writes: string[];
  readonly usesRng: boolean;
}
