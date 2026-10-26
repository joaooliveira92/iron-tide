import type { MonthlyReportEntry } from "../../../shared/reports-contract.js";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { MonthReportCard } from "./MonthReportCard.js";

const report = (month: number, over: Partial<MonthlyReportEntry> = {}): MonthlyReportEntry => ({
  reportId: `save-${month}`,
  campaignId: "camp_1",
  turn: month,
  period: { from: { year: 1880, month }, to: { year: 1880, month: month + 1 } },
  generatedAt: "1880-02-01T00:00:00.000Z",
  treasury: {
    openingTreasury: 1000,
    closingTreasury: 944,
    maintenanceCost: 16,
    constructionSpending: 60,
    researchExpense: 5,
    governmentAllocation: 25,
    netChange: -56,
    ledgerRows: [
      {
        id: "l1",
        description: "Monthly naval appropriation revenue",
        phase: "monthly_revenue",
        amount: 25,
        runningBalance: 1025,
      },
      {
        id: "l2",
        description: "Fleet maintenance",
        phase: "maintenance",
        amount: -16,
        runningBalance: 1009,
      },
      {
        id: "l3",
        description: "Research budget expenditure",
        phase: "resolve_research",
        amount: -5,
        runningBalance: 1004,
      },
    ],
  },
  construction: { projects: [], completedShips: [], newlyActiveProjectIds: [] },
  research: { progress: [], discoveries: [] },
  fleet: { additions: [], totalActiveShips: 8 },
  priorities: [],
  battleOutcomes: [],
  ...over,
});

describe("MonthReportCard", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(cleanup);

  it("says plainly that there is no report before the first month is advanced", () => {
    render(<MonthReportCard reports={[]} />);
    expect(screen.getByText("No months have been advanced yet in this campaign.")).toBeTruthy();
    expect(screen.getByText(/appears here after you advance the month/)).toBeTruthy();
  });

  it("reports the latest month's treasury movement and its real ledger rows", () => {
    render(<MonthReportCard reports={[report(2)]} />);
    expect(screen.getByText("Report for February 1880.")).toBeTruthy();
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("Monthly naval appropriation revenue gained +25");
    expect(card.textContent).toContain("Fleet maintenance lost −16");
    expect(card.textContent).toContain("Research budget expenditure lost −5");
    expect(card.textContent).toContain("treasury moved −56");
  });

  it("shows a reconciliation line that closes and flags every shortfall with requested, paid and unpaid", () => {
    render(
      <MonthReportCard
        reports={[
          report(2, {
            treasury: {
              ...report(2).treasury,
              openingTreasury: 10,
              closingTreasury: 0,
              obligationExpense: 2,
              reconciliation: {
                opening: 10,
                revenue: 3,
                construction: 4,
                preservation: 0,
                maintenance: 2,
                obligation: 2,
                research: 0,
                other: -5,
                closing: 0,
              },
              ledgerRows: [
                {
                  id: "l9",
                  description: "Fleet maintenance",
                  phase: "maintenance",
                  amount: -2,
                  runningBalance: 0,
                  requested: 5,
                  shortfall: 3,
                },
              ],
            },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain(
      "Reconciliation: opening 10 + revenue 3 − construction 4 − maintenance 2 − obligations 2 ± other −5 = closing 0",
    );
    const ledger = screen.getByRole("list", { name: "Financial ledger" });
    expect(ledger.textContent).toContain("requested 5, paid 2, shortfall 3");
    expect(card.textContent).toContain("Obligations 2");
  });

  it("renders the treasury explanation from the report's reconciliation components", () => {
    const treasury = report(2).treasury;
    render(
      <MonthReportCard
        reports={[
          report(2, {
            treasury: {
              ...treasury,
              treasuryExplanation: {
                formulaId: "report_treasury",
                formulaVersion: "report_v1",
                inputs: { opening: 1000 },
                intermediate: { netChange: -56 },
                result: 944,
                unit: "nc",
                children: [
                  {
                    formulaId: "report_treasury.opening",
                    formulaVersion: "report_v1",
                    inputs: { amount: 1000 },
                    intermediate: {},
                    result: 1000,
                    unit: "nc",
                  },
                  {
                    formulaId: "report_treasury.revenue",
                    formulaVersion: "report_v1",
                    inputs: { amount: 25 },
                    intermediate: {},
                    result: 25,
                    unit: "nc",
                  },
                  {
                    formulaId: "report_treasury.maintenance",
                    formulaVersion: "report_v1",
                    inputs: { amount: -16 },
                    intermediate: {},
                    result: -16,
                    unit: "nc",
                  },
                ],
              },
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Treasury closed at 944")).toBeTruthy();
    expect(screen.getByText("Opening treasury")).toBeTruthy();
    expect(screen.getByText("Naval appropriation")).toBeTruthy();
    expect(screen.getByText("Fleet maintenance")).toBeTruthy();
  });

  it("renders the Construction section from real project progress and pre→post deltas", () => {
    render(
      <MonthReportCard
        reports={[
          report(2, {
            construction: {
              projects: [{ projectId: "proj_1", previousWork: 10, newWork: 25 }],
              completedShips: [{ shipId: "s-1", name: "HMS Example" }],
              newlyActiveProjectIds: ["proj_2"],
            },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("construction on proj_1: work 10→25");
    expect(card.textContent).toContain("completed HMS Example");
    expect(card.textContent).toContain("began construction on proj_2");
  });

  it("hides the construction and research sections' detail on a quiet month", () => {
    render(<MonthReportCard reports={[report(2)]} />);
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("No construction activity this month");
    expect(card.textContent).toContain("No research activity this month");
    expect(card.textContent).toContain("No engagements this month");
  });

  it("renders the Research section from real progress and discovery events", () => {
    render(
      <MonthReportCard
        reports={[
          report(2, {
            research: {
              progress: [{ techId: "tech_steam", previousPoints: 4, newPoints: 9 }],
              discoveries: [{ techId: "tech_radio", researchFieldId: "ELECTRONICS" }],
            },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("research advance: tech_steam: 4→9");
    expect(card.textContent).toContain("discovered tech_radio");
  });

  it("renders fleet additions and the active total", () => {
    render(
      <MonthReportCard
        reports={[
          report(2, {
            fleet: {
              additions: [{ shipId: "s-1", name: "HMS Example" }],
              totalActiveShips: 9,
            },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("commissioned HMS Example");
    expect(card.textContent).toContain("9 active ships");
  });

  it("compares priorities against the previous report's fingerprints", () => {
    const priority = (fingerprint: string, title: string) => ({
      id: fingerprint,
      type: "monthly_deficit" as const,
      severity: "warning" as const,
      title,
      summary: "s",
      reason: "r",
      destination: "overview" as const,
      fingerprint,
    });
    render(
      <MonthReportCard
        reports={[
          report(3, {
            priorities: [priority("a", "Fresh deficit"), priority("b", "Still here")],
          }),
          report(2, {
            priorities: [priority("b", "Still here"), priority("c", "Fixed")],
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("Fresh deficit");
    expect(card.textContent).toContain("Fixed");
  });

  it("describes each battle in words in its own Battle Outcomes subsection", () => {
    render(
      <MonthReportCard
        reports={[
          report(2, {
            battleOutcomes: [
              {
                battleId: "b1",
                areaId: "med_malta",
                attackerId: "uk",
                defenderId: "france",
                winnerId: "uk",
                loserId: "france",
                warScoreDelta: 2,
                attackerLosses: ["s1"],
                defenderLosses: ["f1", "f2"],
                explanation: [],
              },
            ],
          }),
        ]}
        areaName={(id) => (id === "med_malta" ? "Malta" : id)}
      />,
    );
    const card = screen.getByTestId("month-report-card");
    expect(card.textContent).toContain("Britain defeated France in Malta");
    expect(card.textContent).not.toMatch(/med_malta|b1/);
  });

  it("never renders a CUT section (diplomacy, stalled projects, budget effectiveness, per-ship maintenance)", () => {
    render(
      <MonthReportCard
        reports={[
          report(2, {
            construction: {
              projects: [{ projectId: "proj_1", previousWork: 10, newWork: 25 }],
              completedShips: [],
              newlyActiveProjectIds: [],
            },
            research: {
              progress: [{ techId: "t", previousPoints: 1, newPoints: 2 }],
              discoveries: [],
            },
          }),
        ]}
      />,
    );
    const text = screen.getByTestId("month-report-card").textContent ?? "";
    expect(text).not.toMatch(/diplomacy/i);
    expect(text).not.toMatch(/stalled/i);
    expect(text).not.toMatch(/budget effectiveness|settings effect/i);
    expect(text).not.toMatch(/per-ship maintenance|maintenance effect/i);
  });

  it("keeps earlier months behind a disclosure and says they persist with the campaign", () => {
    render(
      <MonthReportCard
        reports={[
          report(3),
          report(2, {
            treasury: {
              ...report(2).treasury,
              closingTreasury: 1010,
              netChange: 10,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Report for March 1880.")).toBeTruthy();
    const details = screen.getByText(/Earlier months \(1\)/).closest("details");
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("February 1880");
    expect(details?.textContent).toContain("treasury moved +10.");
    expect(details?.textContent).toContain("Earlier months are kept with this campaign.");
  });
});
