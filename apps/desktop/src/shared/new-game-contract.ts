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

/**
 * Result of `listNewGameOptions`. `supportedValues.playerSlotId` excludes
 * zero-content nations (desktop-mvp map, Empty-Nation Content Gap ticket) —
 * the New Game nation-selection screen's existing two-gate filter
 * (`scenario.playableNationIds` ∩ `supportedValues.playerSlotId`) handles
 * the rest.
 */
export interface NewGameOptions {
  readonly scenarios: readonly NewGameScenario[];
  readonly nations: readonly NewGameNation[];
  readonly supportedValues: SupportedConfigurationValues;
}
