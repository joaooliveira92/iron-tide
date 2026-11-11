import type { SupportedConfigurationValues } from "@bluewave/campaign-engine";

export interface NewGameScenario {
  readonly id: string;
  readonly name: string;
  readonly startYear: number;
  readonly startMonth: number;
  readonly participantNationIds: readonly string[];
  readonly playableNationIds: readonly string[];
}

export interface NewGameResearchPriority {
  readonly field: string;
  readonly priority: number;
}

export interface NewGameGunQualityBand {
  readonly id: string;
  readonly minCaliberUm: number;
  readonly maxCaliberUm: number;
  readonly quality: number;
}

export interface NewGameCommissioningFacts {
  readonly budgetLevel: string | null;
  readonly yardCapacityKg: number | null;
  readonly researchPriorities: readonly NewGameResearchPriority[];
  readonly gunQualityBands: readonly NewGameGunQualityBand[];
}

export interface NewGameNation {
  readonly id: string;
  readonly name: string;
  readonly regimeName: string;
  readonly regimeType: string;
  readonly commissioning?: NewGameCommissioningFacts | null;
}

export interface NewGameOptions {
  readonly scenarios: readonly NewGameScenario[];
  readonly nations: readonly NewGameNation[];
  readonly supportedValues: SupportedConfigurationValues;
}
