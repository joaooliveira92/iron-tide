import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { DEFAULT_CAMPAIGN_PREFERENCES } from "../../shared/preferences-contract.js";
import {
  CAMPAIGN_PREFERENCES_FILENAME,
  loadCampaignPreferencesFile,
} from "./campaignPreferencesStore.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bluewave-campaign-prefs-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("campaign-scope preferences sidecar (U-2 ticket 05)", () => {
  it("returns the central defaults for a missing file", () => {
    expect(loadCampaignPreferencesFile(dir).campaign).toEqual(DEFAULT_CAMPAIGN_PREFERENCES);
  });

  it("reads a written sidecar back", () => {
    const campaign = { ...DEFAULT_CAMPAIGN_PREFERENCES, showSupplyOverlay: true };
    writeFileSync(
      join(dir, CAMPAIGN_PREFERENCES_FILENAME),
      JSON.stringify({ version: 1, campaign }),
    );
    expect(loadCampaignPreferencesFile(dir).campaign).toEqual(campaign);
  });

  it("recovers to defaults from a corrupt or excess-keyed file", () => {
    writeFileSync(join(dir, CAMPAIGN_PREFERENCES_FILENAME), "{ not json");
    expect(loadCampaignPreferencesFile(dir).campaign).toEqual(DEFAULT_CAMPAIGN_PREFERENCES);

    writeFileSync(
      join(dir, CAMPAIGN_PREFERENCES_FILENAME),
      JSON.stringify({ version: 1, campaign: { ...DEFAULT_CAMPAIGN_PREFERENCES, extra: true } }),
    );
    expect(loadCampaignPreferencesFile(dir).campaign).toEqual(DEFAULT_CAMPAIGN_PREFERENCES);
  });
});
