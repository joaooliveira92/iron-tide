/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import * as settingsModal from "../../components/shared/SettingsModal.js";
import { CampaignPreferencesScreen } from "./CampaignPreferencesScreen.js";

const projection: PlayerProjection = {
  prestige: { current: 20, sackingThreshold: 16, dismissalRisk: false },
  campaignIdentity: "campaign_1",
  revision: 3 as PlayerProjection["revision"],
  month: { year: 1880, month: 3 },
  playerNationId: "uk",
  nationName: "United Kingdom",
  projectedSurplusDeficit: 3000,
  economy: {
    treasury: 50000,
    monthlyAppropriation: 4000,
    shipyardCapacity: 50,
    constructionSpend: 500,
    researchSpend: 300,
    maintenanceCost: 200,
    obligations: 0,
    researchRequested: 300,
    researchCap: 480,
    plannedConstruction: 500,
    projectedNet: 3000,
    shortfall: 0,
    status: "healthy",
    monthEndTreasury: 53000,
  },
  knownTechnologyIds: [],
  fleet: [],
  strategicAreas: [],
  ports: [],
  knownEnemyNations: [],
  commandWorkspace: { commands: [], movementCommands: [] },
  snapshotHash: "hash_abc123",
};

const reload = () => {};

vi.mock("../../lib/use-campaign-projection.js", () => ({
  useCampaignProjection: () => ({ projection, loadError: null, reload }),
}));

vi.mock("../../components/shared/SettingsModal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../components/shared/SettingsModal.js")>();
  return { ...actual, SettingsSection: vi.fn(actual.SettingsSection) };
});

vi.stubGlobal(
  "ResizeObserver",
  class implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

afterEach(() => {
  cleanup();
  vi.mocked(settingsModal.SettingsSection).mockClear();
});

describe("CampaignPreferencesScreen danger zone memo", () => {
  it("does not re-render the danger panel when the screen re-renders with unchanged inputs", () => {
    const onCloseCampaign = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <CampaignPreferencesScreen
        sessionId="ses-1"
        onCloseCampaign={onCloseCampaign}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Danger zone$/ }));
    expect(screen.getByRole("button", { name: "Close Campaign" })).toBeTruthy();
    vi.mocked(settingsModal.SettingsSection).mockClear();

    rerender(
      <CampaignPreferencesScreen
        sessionId="ses-1"
        onCloseCampaign={onCloseCampaign}
        onClose={onClose}
      />,
    );

    expect(settingsModal.SettingsSection).not.toHaveBeenCalled();
  });
});
