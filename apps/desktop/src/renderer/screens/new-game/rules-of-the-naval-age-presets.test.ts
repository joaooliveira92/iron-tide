import { describe, expect, it } from "vite-plus/test";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";
import {
  applyPreset,
  detectActivePreset,
  PRESET_DEFINITIONS,
} from "./rules-of-the-naval-age-presets.js";

function basePreferences(overrides: Partial<DraftPreferences> = {}): DraftPreferences {
  return {
    version: "campaign_configuration_v1",
    scenarioId: "scen_1900",
    continuityMode: "historical",
    fleetSize: "standard",
    researchSpeed: "standard",
    technologyVariation: "some",
    historicalBudget: "standard",
    legacyFleetMode: "generated",
    tacticalRealism: "standard",
    difficulty: "normal",
    campaignSeed: "SEED-1",
    ...overrides,
  };
}

describe("rules-of-the-naval-age-presets", () => {
  it("detects the Admiral preset as active when its exact six-setting bundle is set", () => {
    expect(detectActivePreset(basePreferences())).toBe("admiral");
  });

  it("detects Custom when a value doesn't match any preset bundle", () => {
    expect(detectActivePreset(basePreferences({ difficulty: "hard" }))).toBe("custom");
  });

  it.each(PRESET_DEFINITIONS.map((preset) => preset.id))(
    "applies the %s preset's exact six-setting bundle",
    (presetId) => {
      const preferences = applyPreset(basePreferences({ difficulty: "hard" }), presetId);
      expect(detectActivePreset(preferences)).toBe(presetId);
    },
  );

  it("preserves fields the preset bundle doesn't cover", () => {
    const preferences = applyPreset(basePreferences(), "cadet");
    expect(preferences.scenarioId).toBe("scen_1900");
    expect(preferences.campaignSeed).toBe("SEED-1");
  });

  it("reverts to Custom after editing a single field post-preset", () => {
    const preferences = applyPreset(basePreferences(), "cadet");
    const edited: DraftPreferences = { ...preferences, difficulty: "hard" };
    expect(detectActivePreset(edited)).toBe("custom");
  });

  it("matches the spec's exact six-setting bundles", () => {
    const byId = new Map(PRESET_DEFINITIONS.map((preset) => [preset.id, preset.bundle]));
    expect(byId.get("cadet")).toEqual({
      fleetSize: "small",
      researchSpeed: "standard",
      technologyVariation: "none",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "easy",
    });
    expect(byId.get("admiral")).toEqual({
      fleetSize: "standard",
      researchSpeed: "standard",
      technologyVariation: "some",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "normal",
    });
    expect(byId.get("naval_historian")).toEqual({
      fleetSize: "large",
      researchSpeed: "slow",
      technologyVariation: "none",
      historicalBudget: "historical",
      tacticalRealism: "realistic",
      difficulty: "hard",
    });
    expect(byId.get("alternate_history")).toEqual({
      fleetSize: "standard",
      researchSpeed: "fast",
      technologyVariation: "considerable",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "normal",
    });
  });
});
