import type { CampaignConfiguration } from "@bluewave/campaign-engine";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

export function buildCampaignConfiguration(
  nationId: string,
  preferences: DraftPreferences,
  legacyFleetModeId: string,
): CampaignConfiguration {
  return {
    scenarioId: preferences.scenarioId as CampaignConfiguration["scenarioId"],
    playerSlotId: nationId,
    continuityModeId: preferences.continuityMode as CampaignConfiguration["continuityModeId"],
    fleetSizeSettingId: preferences.fleetSize as CampaignConfiguration["fleetSizeSettingId"],
    researchSpeedSettingId:
      preferences.researchSpeed as CampaignConfiguration["researchSpeedSettingId"],
    technologyVariationSettingId:
      preferences.technologyVariation as CampaignConfiguration["technologyVariationSettingId"],
    historicalBudgetOptionId: preferences.historicalBudget,
    legacyFleetModeId,
    tacticalRealismModeId: preferences.tacticalRealism,
    difficultyProfileId: preferences.difficulty,
    campaignSeed: preferences.campaignSeed,
    configurationSchemaVersion: preferences.version,
  };
}
