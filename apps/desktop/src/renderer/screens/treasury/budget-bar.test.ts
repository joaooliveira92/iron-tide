import { describe, expect, it } from "vite-plus/test";

import { BUDGET_SEGMENTS, buildBudgetBar } from "./budget-bar.js";
import type { TreasuryBreakdown } from "./treasury-summary.js";

const breakdown = (over: Partial<TreasuryBreakdown>): TreasuryBreakdown => ({
  income: 100,
  fleetMaintenance: 20,
  constructionSpend: 10,
  researchSpend: 10,
  totalExpenditure: 40,
  projectedSurplusDeficit: 60,
  availableFunds: 0,
  projectedMonthEndFunds: 60,
  ...over,
});

describe("buildBudgetBar", () => {
  it("scales segments and the income marker to one shared width", () => {
    const bar = buildBudgetBar(breakdown({}));
    expect(bar.overBudget).toBe(false);
    expect(bar.incomeMarker).toBe(1);
    expect(bar.segments.map((s) => [s.id, s.width])).toEqual([
      ["maintenance", 0.2],
      ["construction", 0.1],
      ["research", 0.1],
    ]);
    expect(bar.segments.map((s) => s.shareOfSpend)).toEqual([0.5, 0.25, 0.25]);
  });

  it("shows over-spending as the stack running past the income marker", () => {
    const bar = buildBudgetBar(
      breakdown({
        income: 50,
        fleetMaintenance: 60,
        constructionSpend: 30,
        researchSpend: 10,
        totalExpenditure: 100,
      }),
    );
    expect(bar.overBudget).toBe(true);
    // The scale becomes the spend (100): income sits at the halfway line.
    expect(bar.incomeMarker).toBe(0.5);
    expect(bar.overBudgetBy).toBe(50);
    expect(bar.segments.reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(1, 10);
  });

  it("copes with a zero budget without dividing by zero", () => {
    const bar = buildBudgetBar(
      breakdown({
        income: 0,
        fleetMaintenance: 0,
        constructionSpend: 0,
        researchSpend: 0,
        totalExpenditure: 0,
      }),
    );
    expect(bar.incomeMarker).toBe(0);
    expect(bar.overBudget).toBe(false);
    expect(bar.overBudgetBy).toBe(0);
    expect(bar.segments.every((s) => s.width === 0 && s.shareOfSpend === 0)).toBe(true);
  });

  it("builds a self-describing accessible label from the segment catalog", () => {
    const bar = buildBudgetBar(breakdown({}));
    expect(bar.label).toBe(
      "Monthly budget: income 100; expenditure 40 (Fleet maintenance 20, Construction 10, Research 10). Spending is within income.",
    );
  });

  it("names every segment and its colour token from one catalog", () => {
    expect(BUDGET_SEGMENTS.map((s) => s.id)).toEqual(["maintenance", "construction", "research"]);
    const bar = buildBudgetBar(breakdown({}));
    expect(bar.segments.map((s) => [s.id, s.label, s.className])).toEqual(
      BUDGET_SEGMENTS.map((s) => [s.id, s.label, s.className]),
    );
  });
});
