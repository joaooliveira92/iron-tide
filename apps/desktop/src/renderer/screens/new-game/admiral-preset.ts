export interface AdmiralPresetValues {
  readonly fleetSize: string;
  readonly researchSpeed: string;
  readonly technologyVariation: string;
  readonly historicalBudget: string;
  readonly tacticalRealism: string;
  readonly difficulty: string;
}

export const ADMIRAL_PRESET_VALUES: AdmiralPresetValues = {
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "some",
  historicalBudget: "standard",
  tacticalRealism: "standard",
  difficulty: "normal",
};

export const RECOMMENDED_FLEET_METHOD_ID = "generated";
