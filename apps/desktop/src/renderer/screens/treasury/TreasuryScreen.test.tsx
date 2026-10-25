/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import type { MonthlyReportEntry } from "../../../shared/reports-contract.js";
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

const commitments = vi.hoisted(() => ({
  value: {
    fleet: {
      total: 200,
      atWar: true,
      warSurcharge: 25,
      groups: [
        { readiness: "ACTIVE", ships: 2, cost: 150, multiplierBp: 10_000 },
        { readiness: "RESERVE", ships: 1, cost: 50, multiplierBp: 7_500 },
      ],
      ships: [
        { id: "s1", name: "HMS Warrior", readiness: "ACTIVE", cost: 100, overBase: false },
        { id: "s2", name: "HMS Resolute", readiness: "RESERVE", cost: 50, overBase: true },
      ],
    },
    construction: {
      projects: [
        {
          projectId: "p1",
          className: "Ironclad",
          shipType: "Battleship",
          status: "ACTIVE",
          draw: 400,
          carryingCost: 0,
          foreign: false,
          percentComplete: 40,
        },
        {
          projectId: "p2",
          className: "Monitor",
          shipType: "Coastal",
          status: "HALTED",
          draw: 0,
          carryingCost: 12,
          foreign: false,
          percentComplete: 10,
        },
      ],
      drawTotal: 400,
      carryingTotal: 12,
      haltedCount: 1,
    },
    unpaidCostsPrestige: { triggered: true, before: 20, after: 19, sackingThreshold: 16 },
  },
}));

const reportsMock = vi.hoisted(() => ({
  reports: [] as readonly MonthlyReportEntry[],
}));

vi.mock("../overview/useMonthlyReports.js", () => ({
  useMonthlyReports: () => ({ reports: reportsMock.reports, loading: false }),
}));

vi.mock("./hooks/useBudgetPolicyPanel.js", () => ({
  useBudgetPolicy: () => ({
    controller: { state: { commitments: commitments.value } },
    vm: { previewResearch: null, rateChanged: false },
  }),
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

    expect(screen.getByText("Fleet maintenance")).not.toBeNull();
    expect(screen.getByText("Research")).not.toBeNull();
    expect(screen.getByText("Fixed obligations")).not.toBeNull();
    expect(screen.getByText("Construction (up to)")).not.toBeNull();
    expect(screen.getByText("Committed expenditure")).not.toBeNull();
    expect(screen.getAllByText("500").length).toBeGreaterThanOrEqual(1);

    const status = screen.getByRole("region", { name: "Treasury status" });
    expect(within(status).getByText("Net before construction")).not.toBeNull();
    expect(within(status).getByText("Available funds")).not.toBeNull();
    expect(within(status).getByText("Month-end funds")).not.toBeNull();
    expect(within(status).getByText("50,000")).not.toBeNull();
    expect(within(status).getByText("53,000")).not.toBeNull();
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
    expect(screen.getAllByText("Critical").length).toBeGreaterThanOrEqual(1);
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

  it("opens the fleet upkeep breakdown from the maintenance row", () => {
    render(<TreasuryScreen sessionId="ses-1" />);
    fireEvent.click(screen.getByRole("button", { name: /^Fleet maintenance: 200/ }));
    const upkeep = screen.getByTestId("fleet-upkeep");
    expect(within(upkeep).getByText(/The fleet costs 200 a month to keep/)).not.toBeNull();
    expect(within(upkeep).getByText(/At war \+25/)).not.toBeNull();
    expect(
      within(upkeep).getByRole("button", { name: /HMS Warrior: 100 a month, Active/ }),
    ).not.toBeNull();
    expect(
      screen.getByRole("img", { name: /Fleet upkeep by readiness: Active 150, Reserve 50/ }),
    ).not.toBeNull();
  });

  it("opens the construction commitments with halted carrying cost called out", () => {
    render(<TreasuryScreen sessionId="ses-1" />);
    fireEvent.click(screen.getByRole("button", { name: /^Construction \(up to\)/ }));
    const construction = screen.getByTestId("construction-commitments");
    expect(within(construction).getByText(/up to 412 this month/)).not.toBeNull();
    expect(within(construction).getByText(/1 halted project costs 12 a month/)).not.toBeNull();
    expect(
      within(construction).getByRole("button", { name: /Monitor: Halted, 12 this month/ }),
    ).not.toBeNull();
  });

  it("warns about the prestige cost only when obligations will go unpaid", () => {
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByText(/Unpaid obligations also cost prestige: 20 → 19/)).not.toBeNull();
    expect(screen.getByText(/Dismissal risk begins at 16/)).not.toBeNull();
    cleanup();
    const untriggered = {
      ...commitments.value,
      unpaidCostsPrestige: { triggered: false, before: 20, after: 19, sackingThreshold: 16 },
    };
    const original = commitments.value;
    commitments.value = untriggered;
    hookMocks.state.mockReturnValue({
      projection: { ...projection, economy: { ...projection.economy, shortfall: 40 } },
      loadError: null,
    });
    render(<TreasuryScreen sessionId="ses-1" />);
    expect(screen.getByText(/Shortfall: 40/)).not.toBeNull();
    expect(screen.queryByText(/also cost prestige/)).toBeNull();
    commitments.value = original;
  });

  describe("history", () => {
    const month = (
      turn: number,
      opening: number,
      closing: number,
      ledgerRows: MonthlyReportEntry["treasury"]["ledgerRows"] = [],
    ): MonthlyReportEntry => ({
      reportId: `r${turn}`,
      campaignId: "c",
      turn,
      period: { from: { year: 1880, month: turn }, to: { year: 1880, month: turn } },
      generatedAt: "",
      treasury: {
        openingTreasury: opening,
        closingTreasury: closing,
        maintenanceCost: 16,
        constructionSpending: 2,
        researchExpense: 5,
        governmentAllocation: 100,
        netChange: closing - opening,
        obligationExpense: 38,
        ledgerRows,
        reconciliation: {
          opening,
          revenue: 100,
          construction: 2,
          preservation: 0,
          maintenance: 16,
          obligation: 38,
          research: 5,
          other: 0,
          closing,
        },
      },
      construction: { projects: [], completedShips: [], newlyActiveProjectIds: [] },
      research: { progress: [], discoveries: [] },
      fleet: { additions: [], totalActiveShips: 0 },
      priorities: [],
      battleOutcomes: [],
    });

    afterEach(() => {
      reportsMock.reports = [];
    });

    it("explains that nothing has closed before the first month ends", () => {
      render(<TreasuryScreen sessionId="ses-1" />);
      fireEvent.click(screen.getByRole("tab", { name: "History" }));
      expect(screen.getByTestId("history-empty").textContent).toMatch(/No month has closed yet/);
    });

    it("charts the closed months, opens the latest ledger, and switches month on click", () => {
      reportsMock.reports = [
        month(1, 1000, 1040),
        month(2, 1040, 1060, [
          {
            id: "tx1",
            description: "Mandatory fixed expenses",
            phase: "obligation",
            amount: -30,
            runningBalance: 1060,
            requested: 38,
            shortfall: 8,
          },
        ]),
      ];
      render(<TreasuryScreen sessionId="ses-1" />);
      fireEvent.click(screen.getByRole("tab", { name: "History" }));
      expect(
        screen.getByText(/Over the last 2 months the treasury went from 1,000 to 1,060/),
      ).not.toBeNull();
      const ledger = screen.getByTestId("month-ledger");
      expect(within(ledger).getByText(/Requested 38, paid 30, left unpaid 8/)).not.toBeNull();
      expect(within(ledger).getByText(/1,040 → 1,060/)).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /^January 1880: closing 1,040/ }));
      const first = screen.getByTestId("month-ledger");
      expect(within(first).getByText(/1,000 → 1,040/)).not.toBeNull();
      expect(within(first).getByText("No ledger entries were recorded this month.")).not.toBeNull();
    });
  });
});
