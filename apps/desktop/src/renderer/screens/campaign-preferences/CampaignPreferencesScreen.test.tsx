/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

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

vi.mock("../../lib/use-campaign-projection.js", () => ({
  useCampaignProjection: () => ({ projection, loadError: null, reload: () => {} }),
}));

vi.stubGlobal(
  "ResizeObserver",
  class implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

afterEach(cleanup);

function openSection(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("CampaignPreferencesScreen", () => {
  it("opens as a modal on Scenario and shows one section at a time", () => {
    render(<CampaignPreferencesScreen sessionId="ses-1" />);
    expect(
      screen.getByRole("dialog", { name: /^Campaign preferences\s*\/\s*Scenario$/ }),
    ).toBeTruthy();
    expect(screen.getByText("Current date")).toBeTruthy();
    openSection(/^Ruleset options$/);
    expect(screen.getByText("Continuity mode")).toBeTruthy();
    expect(screen.queryByText("Current date")).toBeNull();
  });

  it("calls onClose when the modal is dismissed and offers to reopen it", async () => {
    const onClose = vi.fn();
    render(<CampaignPreferencesScreen sessionId="ses-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open campaign preferences" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes the section modal before asking to close the campaign, then confirms", async () => {
    const onCloseCampaign = vi.fn();
    const onClose = vi.fn();
    render(
      <CampaignPreferencesScreen
        sessionId="ses-1"
        onCloseCampaign={onCloseCampaign}
        onClose={onClose}
      />,
    );
    openSection(/^Danger zone$/);
    fireEvent.click(screen.getByRole("button", { name: "Close Campaign" }));
    await waitFor(() =>
      expect(screen.getByRole("alertdialog", { name: "Close this campaign?" })).toBeTruthy(),
    );
    expect(screen.queryByRole("dialog", { name: /Campaign preferences/ })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onCloseCampaign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close Campaign" }));
    expect(onCloseCampaign).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByRole("dialog", { name: /Campaign preferences/ })).toBeNull();
  });

  it("returns to Danger zone when the confirmation is cancelled", async () => {
    const onCloseCampaign = vi.fn();
    const onClose = vi.fn();
    render(
      <CampaignPreferencesScreen
        sessionId="ses-1"
        onCloseCampaign={onCloseCampaign}
        onClose={onClose}
      />,
    );
    openSection(/^Danger zone$/);
    fireEvent.click(screen.getByRole("button", { name: "Close Campaign" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(
      screen.getByRole("dialog", { name: /^Campaign preferences\s*\/\s*Danger zone$/ }),
    ).toBeTruthy();
    expect(onCloseCampaign).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hides Close Campaign when the shell offers no way to close", () => {
    render(<CampaignPreferencesScreen sessionId="ses-1" />);
    openSection(/^Danger zone$/);
    expect(screen.queryByRole("button", { name: "Close Campaign" })).toBeNull();
  });

  it("says the bridge is unavailable when restarting the inspection without one", async () => {
    render(<CampaignPreferencesScreen sessionId="ses-1" />);
    openSection(/^Display preferences$/);
    fireEvent.click(screen.getByTestId("restart-guided-inspection"));
    await waitFor(() => expect(screen.getByText("Bridge unavailable")).toBeTruthy());
  });
});
