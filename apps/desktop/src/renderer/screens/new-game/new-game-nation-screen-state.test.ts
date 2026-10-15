import { describe, expect, it } from "vite-plus/test";
import { buildCampaignConfiguration } from "./new-game-nation-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

const preferences: DraftPreferences = {
  version: "campaign_configuration_v1",
  scenarioId: "scen_1900",
  continuityMode: "historical",
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "none",
  historicalBudget: "canonical",
  legacyFleetMode: "canonical_fixture",
  tacticalRealism: "admiral",
  difficulty: "standard",
  campaignSeed: "SEED-1",
};

describe("new-game-nation-screen-state", () => {
  it("builds the final configuration from preferences plus the confirmed nation", () => {
    expect(buildCampaignConfiguration("nation_germany", preferences, "historical")).toEqual({
      scenarioId: preferences.scenarioId,
      playerSlotId: "nation_germany",
      continuityModeId: preferences.continuityMode,
      fleetSizeSettingId: preferences.fleetSize,
      researchSpeedSettingId: preferences.researchSpeed,
      technologyVariationSettingId: preferences.technologyVariation,
      historicalBudgetOptionId: preferences.historicalBudget,
      legacyFleetModeId: "historical",
      tacticalRealismModeId: preferences.tacticalRealism,
      difficultyProfileId: preferences.difficulty,
      campaignSeed: preferences.campaignSeed,
      configurationSchemaVersion: preferences.version,
    });
  });
});
