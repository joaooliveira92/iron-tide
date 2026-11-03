import type { MonthlyReportEntry } from "../../../shared/reports-contract.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { NarrativeMonthSummary } from "./NarrativeMonthSummary.js";

const report = (month: number): MonthlyReportEntry => ({
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
    ledgerRows: [],
  },
  construction: { projects: [], completedShips: [], newlyActiveProjectIds: [] },
  research: { progress: [], discoveries: [] },
  fleet: { additions: [], totalActiveShips: 8 },
  priorities: [],
  battleOutcomes: [],
});

describe("NarrativeMonthSummary", () => {
  afterEach(cleanup);

  it("lists earlier months only after the disclosure is opened", () => {
    const { container } = render(
      <NarrativeMonthSummary reports={[report(3), report(2), report(1)]} />,
    );
    expect(screen.getByText("Earlier months (2)")).toBeTruthy();
    expect(screen.queryByText("February 1880")).toBeNull();

    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(screen.getByText("February 1880")).toBeTruthy();
    expect(screen.getByText("January 1880")).toBeTruthy();
  });
});
