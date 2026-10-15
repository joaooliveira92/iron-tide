import type { SupportedConfigurationValues } from "@bluewave/campaign-engine";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import type { AdmiralPresetValues } from "./admiral-preset.js";

export type DraftPreferences = {
  readonly version: string;
  readonly scenarioId: string;
  readonly continuityMode: string;
  readonly fleetSize: string;
  readonly researchSpeed: string;
  readonly technologyVariation: string;
  readonly historicalBudget: string;
  readonly legacyFleetMode: string;
  readonly tacticalRealism: string;
  readonly difficulty: string;
  readonly campaignSeed: string;
};

export interface NewGamePreferencesScreenState {
  readonly options: NewGameOptions | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly preferences: DraftPreferences;
}

const CONFIGURATION_VERSION = "campaign_configuration_v1";

function emptyPreferences(): DraftPreferences {
  return {
    version: CONFIGURATION_VERSION,
    scenarioId: "",
    continuityMode: "",
    fleetSize: "",
    researchSpeed: "",
    technologyVariation: "",
    historicalBudget: "",
    legacyFleetMode: "",
    tacticalRealism: "",
    difficulty: "",
    campaignSeed: "",
  };
}

export function initialNewGamePreferencesScreenState(): NewGamePreferencesScreenState {
  return {
    options: null,
    loading: true,
    error: null,
    preferences: emptyPreferences(),
  };
}

const SIX_SETTING_FIELDS = [
  "fleetSize",
  "researchSpeed",
  "technologyVariation",
  "historicalBudget",
  "tacticalRealism",
  "difficulty",
] as const satisfies readonly (keyof AdmiralPresetValues)[];

/**
 * The six preset-covered fields (spec §2) each fall back from a recommended
 * preset to the first supported value, in that order — shared by every
 * field so the fallback shape isn't repeated six times inline.
 */
function seedSixSettingFields(
  supported: SupportedConfigurationValues,
  recommendedPreset: AdmiralPresetValues | null,
): AdmiralPresetValues {
  const result = {} as Record<string, string>;
  for (const field of SIX_SETTING_FIELDS) {
    result[field] = recommendedPreset?.[field] ?? supported[field][0] ?? "";
  }
  return result as unknown as AdmiralPresetValues;
}

/**
 * Seeds draft preferences from the loaded options. When a "Recommended
 * Setup" preset (spec §1) was applied on the nation-confirmation screen, its
 * six values pre-fill in place of the first supported value — still fully
 * editable, matching the preset picker's pre-fill-not-lock behavior (§2).
 */
export function applyOptionsLoaded(
  state: NewGamePreferencesScreenState,
  options: NewGameOptions,
  defaultSeed: string,
  recommendedPreset: AdmiralPresetValues | null = null,
): NewGamePreferencesScreenState {
  const supported = options.supportedValues;
  return {
    options,
    loading: false,
    error: null,
    preferences: {
      version: CONFIGURATION_VERSION,
      scenarioId: options.scenarios[0]?.id ?? "",
      continuityMode: supported.continuityMode[0] ?? "",
      legacyFleetMode: supported.legacyFleetMode[0] ?? "",
      campaignSeed: defaultSeed,
      ...seedSixSettingFields(supported, recommendedPreset),
    },
  };
}

export function applyOptionsFailed(
  state: NewGamePreferencesScreenState,
  error: string,
): NewGamePreferencesScreenState {
  return { ...state, loading: false, error };
}

export function updatePreference<K extends keyof DraftPreferences>(
  state: NewGamePreferencesScreenState,
  field: K,
  value: DraftPreferences[K],
): NewGamePreferencesScreenState {
  return { ...state, preferences: { ...state.preferences, [field]: value } };
}

export function isReadyToProceed(state: NewGamePreferencesScreenState): boolean {
  return (
    state.options !== null &&
    state.preferences.scenarioId.trim().length > 0 &&
    state.preferences.campaignSeed.trim().length > 0
  );
}

export function selectedScenario(state: NewGamePreferencesScreenState) {
  return (
    state.options?.scenarios.find((scenario) => scenario.id === state.preferences.scenarioId) ??
    null
  );
}
