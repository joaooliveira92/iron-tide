import { ARCHETYPE_PRESETS, type ArchetypeSelection } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import type { NewGameOptions } from "../../../../shared/new-game-contract.js";
import {
  COMMISSIONING_GROUP_ICONS,
  FORECAST_ICONS,
  summaryRowIcon,
} from "./commissioning-review-icons.js";
import { buildSummaryRows } from "../new-game-commissioning-review-screen-state.js";
import { defaultFleetMethod } from "../new-game-fleet-method-screen-state.js";
import { defaultCampaignIdentity } from "../new-game-identity-screen-state.js";
import type { DraftPreferences } from "../new-game-preferences-screen-state.js";

const preferences: DraftPreferences = {
  version: "campaign_configuration_v1",
  scenarioId: "scen_1880",
  continuityMode: "historical",
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "some",
  historicalBudget: "standard",
  legacyFleetMode: "generated",
  tacticalRealism: "standard",
  difficulty: "normal",
  campaignSeed: "TEST",
};

const options: NewGameOptions = {
  scenarios: [],
  nations: [],
  supportedValues: {} as NewGameOptions["supportedValues"],
};

const archetype: ArchetypeSelection = {
  kind: "preset",
  id: ARCHETYPE_PRESETS[0]!.id,
  allocation: { ...ARCHETYPE_PRESETS[0]!.allocation },
};

describe("commissioning-review-icons", () => {
  it("gives every summary row and section an icon", () => {
    const rows = buildSummaryRows({
      nationId: "uk",
      options,
      preferences,
      archetype,
      identity: defaultCampaignIdentity(),
      fleetMethod: defaultFleetMethod(),
    });
    for (const row of rows) {
      expect(summaryRowIcon(row.icon)).toBeTruthy();
      expect(COMMISSIONING_GROUP_ICONS[row.group]).toBeTruthy();
    }
  });

  it("provides a glyph for every forecast mark", () => {
    for (const glyph of Object.values(FORECAST_ICONS)) {
      expect(glyph).toBeTruthy();
    }
  });
});
