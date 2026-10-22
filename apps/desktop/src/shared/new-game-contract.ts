import type { SupportedConfigurationValues } from "@bluewave/campaign-engine";

export interface NewGameScenario {
  readonly id: string;
  readonly name: string;
  readonly startYear: number;
  readonly startMonth: number;
  readonly participantNationIds: readonly string[];
  readonly playableNationIds: readonly string[];
}

export interface NewGameNation {
  readonly id: string;
  readonly name: string;
  readonly regimeName: string;
  readonly regimeType: string;
}

export interface NewGameOptions {
  readonly scenarios: readonly NewGameScenario[];
  readonly nations: readonly NewGameNation[];
  readonly supportedValues: SupportedConfigurationValues;
}
