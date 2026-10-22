import type { AdmiralPresetValues } from "./admiral-preset.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

export type SixSettingBundle = AdmiralPresetValues;

export const SIX_SETTING_FIELDS = [
  "fleetSize",
  "researchSpeed",
  "technologyVariation",
  "historicalBudget",
  "tacticalRealism",
  "difficulty",
] as const satisfies readonly (keyof SixSettingBundle)[];

export type SixSettingField = (typeof SIX_SETTING_FIELDS)[number];

export type PresetId = "cadet" | "admiral" | "naval_historian" | "alternate_history";
export type ActivePresetId = PresetId | "custom";

export interface PresetDefinition {
  readonly id: PresetId;
  readonly name: string;
  readonly tagline: string;
  readonly bundle: SixSettingBundle;
}

export const PRESET_DEFINITIONS: readonly PresetDefinition[] = [
  {
    id: "cadet",
    name: "Cadet",
    tagline: "More information, manageable fleets, gentle pacing.",
    bundle: {
      fleetSize: "small",
      researchSpeed: "standard",
      technologyVariation: "none",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "easy",
    },
  },
  {
    id: "admiral",
    name: "Admiral",
    tagline: "Standard economy, standard uncertainty, limited assistance.",
    bundle: {
      fleetSize: "standard",
      researchSpeed: "standard",
      technologyVariation: "some",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "normal",
    },
  },
  {
    id: "naval_historian",
    name: "Naval Historian",
    tagline: "Historical budgets and technology, realistic fleet scale.",
    bundle: {
      fleetSize: "large",
      researchSpeed: "slow",
      technologyVariation: "none",
      historicalBudget: "historical",
      tacticalRealism: "realistic",
      difficulty: "hard",
    },
  },
  {
    id: "alternate_history",
    name: "Alternate History",
    tagline: "High technological variation and unpredictable world development.",
    bundle: {
      fleetSize: "standard",
      researchSpeed: "fast",
      technologyVariation: "considerable",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "normal",
    },
  },
];

export function detectActivePreset(preferences: DraftPreferences): ActivePresetId {
  const match = PRESET_DEFINITIONS.find((preset) =>
    SIX_SETTING_FIELDS.every((field) => preferences[field] === preset.bundle[field]),
  );
  return match?.id ?? "custom";
}

export function applyPreset(preferences: DraftPreferences, presetId: PresetId): DraftPreferences {
  const preset = PRESET_DEFINITIONS.find((candidate) => candidate.id === presetId);
  if (preset === undefined) return preferences;
  return { ...preferences, ...preset.bundle };
}
