/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { SaveMetadata } from "@bluewave/persistence";

import { applyListLoaded, initialCampaignListScreenState } from "./campaign-list-screen-state.js";
import { CampaignListScreen } from "./CampaignListScreen.js";

/**
 * Render test for the campaign-list screen. The hook is mocked so the test
 * asserts PURE rendering: real `SaveMetadata` rows (the six columns), the
 * honest "—" for legacy/degraded records, and the empty state — never
 * fabricated values.
 */

const modern: SaveMetadata = {
  saveId: "save-1",
  timestamp: "2026-08-01T00:00:00.000Z",
  turnNumber: 4,
  campaignId: "campaign_1",
  snapshotHash: "hash_1",
  compatibilityVersion: "1.1.0",
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
  compatibilityVersion: "1.1.0",
  contentArtifactHash: "art_2",
};

const hookMocks = vi.hoisted(() => {
  const state = vi.fn(() => applyListLoaded(initialCampaignListScreenState(), [modern, legacy]));
  const reload = vi.fn().mockResolvedValue(undefined);
  return { state, reload };
});

const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("./useCampaignList.js", () => ({
  useCampaignList: () => ({ state: hookMocks.state(), reload: hookMocks.reload }),
}));

afterEach(() => {
  cleanup();
  hookMocks.state.mockClear();
});

describe("CampaignListScreen", () => {
  it("renders real saves with all six columns", () => {
    render(<CampaignListScreen />);

    expect(screen.getByText("Campaign name")).not.toBeNull();
    expect(screen.getByText("Nation")).not.toBeNull();
    expect(screen.getByText("Current date")).not.toBeNull();
    expect(screen.getByText("Last saved")).not.toBeNull();
    expect(screen.getByText("Save-format version")).not.toBeNull();
    expect(screen.getByText("Campaign status")).not.toBeNull();

    expect(screen.getByText("Admiralty Board")).not.toBeNull();
    expect(screen.getByText("uk")).not.toBeNull();
    expect(screen.getByText("1880-02")).not.toBeNull();
    // Both rows carry the real string-typed compatibility version.
    expect(screen.getAllByText("1.1.0").length).toBeGreaterThanOrEqual(2);
  });

  it("renders an honest — for legacy/degraded records without fabricated values", () => {
    render(<CampaignListScreen />);

    // The legacy record's missing additive fields render as "—" (six dashes:
    // name, nation, date fallback is the honest turn, empty last-saved, and
    // the status column which is not derivable from SaveMetadata).
    expect(screen.getByText("Turn 0")).not.toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("renders the empty state when there are no saves", () => {
    hookMocks.state.mockReturnValue(applyListLoaded(initialCampaignListScreenState(), []));
    render(<CampaignListScreen />);
    expect(screen.getByText("No saved campaigns found in this package.")).not.toBeNull();
  });
});
