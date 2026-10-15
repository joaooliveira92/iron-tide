export interface AdmiralPresetValues {
  readonly fleetSize: string;
  readonly researchSpeed: string;
  readonly technologyVariation: string;
  readonly historicalBudget: string;
  readonly tacticalRealism: string;
  readonly difficulty: string;
}

/**
 * The "Rules of the Naval Age" preset picker's (spec §2) "Admiral" bundle —
 * real `packages/campaign` setting ids. Applied early by the nation-
 * confirmation screen's "Recommended Setup" control (spec §1) before the
 * preset-picker screen itself exists (INC-3), so this lives independently of
 * `DraftPreferences`, which additionally requires scenario-fetched data
 * (`scenarioId`, `campaignSeed`, ...) not yet available at that point.
 */
export const ADMIRAL_PRESET_VALUES: AdmiralPresetValues = {
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "some",
  historicalBudget: "standard",
  tacticalRealism: "standard",
  difficulty: "normal",
};

/** Starting-fleet method (spec §5) recommended alongside the Admiral preset. */
export const RECOMMENDED_FLEET_METHOD_ID = "generated";
