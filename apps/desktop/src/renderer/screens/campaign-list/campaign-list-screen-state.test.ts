import { describe, expect, it } from "vite-plus/test";
import type { SaveMetadata } from "@bluewave/persistence";

import {
  applyListLoaded,
  applyLoadFailed,
  campaignDateLabel,
  initialCampaignListScreenState,
} from "./campaign-list-screen-state.js";

const modern: SaveMetadata = {
  saveId: "save-1",
  timestamp: "2026-08-01T00:00:00.000Z",
  turnNumber: 4,
  campaignId: "campaign_1",
  snapshotHash: "hash_1",
  compatibilityVersion: "1.2.0",
  contentArtifactHash: "art_1",
  campaignName: "Admiralty Board",
  nationId: "uk",
  campaignDate: { year: 1880, month: 2 },
};

const legacy: SaveMetadata = {
  saveId: "save-2",
  timestamp: "",
  turnNumber: 0,
  campaignId: "",
  snapshotHash: "",
  compatibilityVersion: "1.2.0",
  contentArtifactHash: "art_2",
};

describe("campaign-list-screen-state", () => {
  it("starts with no saves loaded", () => {
    const state = initialCampaignListScreenState();
    expect(state.saves).toBeNull();
    expect(state.loadError).toBeNull();
  });

  it("applies a loaded list and clears prior errors", () => {
    const failed = applyLoadFailed(initialCampaignListScreenState(), "PACKAGE_SELECTION_CANCELLED");
    const loaded = applyListLoaded(failed, [modern, legacy]);
    expect(loaded.saves).toEqual([modern, legacy]);
    expect(loaded.loadError).toBeNull();
  });

  it("records a load failure", () => {
    const state = applyLoadFailed(initialCampaignListScreenState(), "LOAD_FAILED");
    expect(state.loadError).toBe("LOAD_FAILED");
  });

  it("labels a modern save by its campaignDate", () => {
    expect(campaignDateLabel(modern)).toBe("1880-02");
  });

  it("falls back to the honest turnNumber for a legacy save without campaignDate", () => {
    expect(campaignDateLabel(legacy)).toBe("Turn 0");
  });
});
