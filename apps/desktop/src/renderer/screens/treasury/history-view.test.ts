import { describe, expect, it } from "vite-plus/test";

import type { MonthlyReportEntry } from "../../../shared/reports-contract.js";
import { buildHistory } from "./history-view.js";

function report(
  turn: number,
  over: Partial<MonthlyReportEntry["treasury"]> = {},
): MonthlyReportEntry {
  return {
    reportId: `r${turn}`,
    campaignId: "c",
    turn,
    period: { from: { year: 1880, month: turn }, to: { year: 1880, month: turn } },
    generatedAt: "",
    treasury: {
      openingTreasury: 1000,
      closingTreasury: 1040,
      maintenanceCost: 16,
      constructionSpending: 2,
      researchExpense: 5,
      governmentAllocation: 100,
      netChange: 40,
      ledgerRows: [],
      obligationExpense: 38,
      ...over,
    },
    construction: { projects: [], completedShips: [], newlyActiveProjectIds: [] },
    research: { progress: [], discoveries: [] },
    fleet: { additions: [], totalActiveShips: 0 },
    priorities: [],
    battleOutcomes: [],
  };
}

describe("buildHistory", () => {
  it("orders months oldest first and totals what each month spent", () => {
    const history = buildHistory([report(3), report(1), report(2)], 24);
    expect(history.months.map((m) => m.turn)).toEqual([1, 2, 3]);
    expect(history.months[0]).toMatchObject({
      income: 100,
      spent: 61,
      net: 40,
      obligations: 38,
      maintenance: 16,
      research: 5,
      construction: 2,
    });
    expect(history.hiddenEarlier).toBe(0);
  });

  it("keeps only the latest months and says how many it left out", () => {
    const history = buildHistory([report(1), report(2), report(3), report(4)], 2);
    expect(history.months.map((m) => m.turn)).toEqual([3, 4]);
    expect(history.hiddenEarlier).toBe(2);
  });

  it("sums unpaid amounts from the ledger rows as the month's shortfall", () => {
    const rows = [
      {
        id: "a",
        description: "x",
        phase: "p",
        amount: -5,
        runningBalance: 0,
        requested: 9,
        shortfall: 4,
      },
      { id: "b", description: "y", phase: "p", amount: -1, runningBalance: 0 },
    ];
    expect(buildHistory([report(1, { ledgerRows: rows })], 24).months[0]?.shortfall).toBe(4);
  });

  it("places the cash line between the lowest and highest closing balance, high at the top", () => {
    const history = buildHistory(
      [report(1, { closingTreasury: 1000 }), report(2, { closingTreasury: 1200 })],
      24,
    );
    expect(history.months.map((m) => m.cashY)).toEqual([1, 0]);
    expect(history.months.map((m) => m.centre)).toEqual([0.25, 0.75]);
  });

  it("centres a flat cash line and scales spending to the larger of income and outflow", () => {
    const history = buildHistory([report(1, { closingTreasury: 1040 })], 24);
    expect(history.months[0]?.cashY).toBe(0.5);
    expect(history.spendScale).toBe(100);
    expect(buildHistory([], 24)).toEqual({ months: [], hiddenEarlier: 0, spendScale: 1 });
  });
});
