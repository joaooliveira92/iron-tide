// The phase-registry resource vocabulary: canonical resource domains and the
// footprint type. Hosted in a dependency-free module so any phase descriptor
// (and phase-guard, which needs to derive PHASE_FOOTPRINTS from the registry)
// can import it without forming an ESM value cycle.
//
// These map to snapshot regions the MonthExecutor phases actually read/write.
// `all` is a wildcard.
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
  /** resources the phase reads */
  readonly reads: string[];
  /** resources the phase writes */
  readonly writes: string[];
  /** whether the phase draws randomness */
  readonly usesRng: boolean;
}
