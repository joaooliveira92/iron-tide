/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import { TreasuryScreen } from "./TreasuryScreen.js";

/**
 * Render test for the Treasury screen. The hook is mocked so the test
 * asserts PURE rendering: every figure comes from the projection (income /
 * expenditure rows / result), the allocation panel is hosted, and honest error /
 * loading states.
 */

const projection: PlayerProjection = {
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
  },
  knownTechnologyIds: [],
  fleet: [
    {
      name: "Channel Fleet",
      divisions: [{ name: "Channel Squadron", areaId: "area_northern_europe", ships: [] }],
    },
  ],
  strategicAreas: [],
  ports: [],
  knownEnemyNations: [],
  commandWorkspace: { commands: [], movementCommands: [] },
  snapshotHash: "hash_abc123",
};

const hookMocks = vi.hoisted(() => {
  const state = vi.fn(() => ({ projection, loadError: null }));
  return { state };
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

vi.mock("../../lib/use-campaign-projection.js", () => ({
  useCampaignProjection: () => hookMocks.state(),
}));

vi.mock("./components/BudgetPolicyPanel.js", () => ({
  BudgetPolicyPanel: () => <div data-testid="budget-policy-panel-stub" />,
}));

afterEach(() => {
  cleanup();
  hookMocks.state.mockClear();
});

describe("TreasuryScreen", () => {
  it("renders the real income / expenditure / result figures from the projection", () => {
    render(<TreasuryScreen sessionId="ses-1" />);

    expect(screen.getByText("Government naval allocation")).not.toBeNull();
    // Income appears in its own card (and again in the budget bar legend): check the card.
    expect(
      within(
        screen.getByText("Government naval allocation").parentElement as HTMLElement,
      ).getByText("4,000"),
    ).not.toBeNull();

    // Named in the expenditure card and again in the budget bar legend.
    expect(screen.getAllByText("Fleet maintenance").length).toBeGreaterThanOrEqual(2);
    // Named in the expenditure card and again in the budget bar legend.
    expect(screen.getAllByText("Construction").length).toBeGreaterThanOrEqual(2);
    // Named in the expenditure card and again in the budget bar legend.
    expect(screen.getAllByText("Research").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Total expenditure")).not.toBeNull();
    expect(screen.getByText("1,000")).not.toBeNull();

    expect(screen.getByText("Projected surplus / deficit")).not.toBeNull();
    expect(screen.getByText("Available funds")).not.toBeNull();
    expect(screen.getByText("Projected month-end funds")).not.toBeNull();
    expect(screen.getByText("50,000")).not.toBeNull();
    expect(screen.getByText("53,000")).not.toBeNull();
    expect(screen.getByText("Surplus")).not.toBeNull();
  });

  it("hosts the budget allocation panel (its own tests cover the controls)", () => {
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByTestId("budget-policy-panel-stub")).not.toBeNull();
  });

  it("flags a deficit honestly from a negative projected surplus", () => {
    const deficit: PlayerProjection = {
      ...projection,
      projectedSurplusDeficit: -250,
      economy: { ...projection.economy, maintenanceCost: 2500 },
    };
    hookMocks.state.mockReturnValue({ projection: deficit, loadError: null });
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByText("Deficit")).not.toBeNull();
  });

  it("shows the budget at a glance with every segment named in text, not colour alone", () => {
    hookMocks.state.mockReturnValue({ projection, loadError: null });
    render(<TreasuryScreen sessionId="ses-1" />);
    const bar = screen.getByRole("img", { name: /Monthly budget: income 4,000/ });
    expect(bar.getAttribute("aria-label")).toContain("Fleet maintenance 200");
    expect(bar.getAttribute("aria-label")).toContain("Construction 500");
    expect(bar.getAttribute("aria-label")).toContain("Research 300");
    expect(bar.getAttribute("aria-label")).toContain("Spending is within income.");
    expect(screen.getByTestId("budget-bar").textContent).toContain("Income");
  });
});
