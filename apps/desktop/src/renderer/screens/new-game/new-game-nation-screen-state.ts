import type { CampaignConfiguration } from "@bluewave/campaign-engine";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

/**
 * `DraftPreferences`' field names are screen-local shorthand; `CampaignConfiguration`
 * (re-exported unchanged from `@bluewave/campaign`, DESIGN-03) uses the
 * canonical `*Id`-suffixed names. This maps one to the other explicitly
 * rather than spreading, since the names don't match 1:1.
 *
 * `legacyFleetModeId` is taken as its own parameter rather than read off
 * `preferences.legacyFleetMode` (a silent first-supported-value default from
 * the Preferences screen) — the real, user-chosen value lives in the
 * fleet-method screen's draft (spec §5), so callers supply it directly.
 */
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
