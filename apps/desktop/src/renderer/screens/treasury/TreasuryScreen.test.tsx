/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import { TreasuryScreen } from "./TreasuryScreen.js";

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

    expect(screen.getByText("Monthly naval appropriation")).not.toBeNull();
    expect(
      within(
        screen.getByText("Monthly naval appropriation").parentElement as HTMLElement,
      ).getByText("4,000"),
    ).not.toBeNull();

    expect(screen.getAllByText("Fleet maintenance").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Research").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Fixed obligations").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Construction (up to)")).not.toBeNull();
    expect(screen.getByText("Committed expenditure")).not.toBeNull();
    expect(screen.getAllByText("500").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Projected net before construction")).not.toBeNull();
    expect(screen.getByText("Available funds")).not.toBeNull();
    expect(screen.getByText("Projected month-end funds")).not.toBeNull();
    expect(screen.getByText("50,000")).not.toBeNull();
    expect(screen.getByText("53,000")).not.toBeNull();
    expect(screen.getByText("Healthy")).not.toBeNull();
  });

  it("hosts the budget allocation panel (its own tests cover the controls)", () => {
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByTestId("budget-policy-panel-stub")).not.toBeNull();
  });

  it("flags a deficit honestly, with the shortfall, the runway and why research is unpaid", () => {
    const deficit: PlayerProjection = {
      ...projection,
      projectedSurplusDeficit: -250,
      economy: {
        ...projection.economy,
        maintenanceCost: 2500,
        projectedNet: -250,
        status: "critical",
        shortfall: 40,
        runwayMonths: 12,
        researchSpend: 0,
        researchUnfundedReason: "NO_ELIGIBLE_RESEARCH_FIELD",
      },
    };
    hookMocks.state.mockReturnValue({ projection: deficit, loadError: null });
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByText("Critical")).not.toBeNull();
    expect(screen.getByText(/Shortfall: 40/)).not.toBeNull();
    expect(screen.getByText(/Treasury lasts 12 months/)).not.toBeNull();
    expect(screen.getByText(/no field can take it, so nothing is paid/)).not.toBeNull();
  });

  it("says a too-small appropriation cannot fund research", () => {
    const small: PlayerProjection = {
      ...projection,
      economy: { ...projection.economy, researchCap: 0, researchRequested: 0, researchSpend: 0 },
    };
    hookMocks.state.mockReturnValue({ projection: small, loadError: null });
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByText(/too small to fund research/)).not.toBeNull();
  });

  it("shows the budget at a glance with every segment named in text, not colour alone", () => {
    hookMocks.state.mockReturnValue({ projection, loadError: null });
    render(<TreasuryScreen sessionId="ses-1" />);
    const bar = screen.getByRole("img", { name: /Monthly budget: income 4,000/ });
    expect(bar.getAttribute("aria-label")).toContain("Fleet maintenance 200");
    expect(bar.getAttribute("aria-label")).toContain("Obligations 0");
    expect(bar.getAttribute("aria-label")).toContain("Research 300");
    expect(bar.getAttribute("aria-label")).toContain("Spending is within income.");
    expect(screen.getByTestId("budget-bar").textContent).toContain("Income");
  });
});
