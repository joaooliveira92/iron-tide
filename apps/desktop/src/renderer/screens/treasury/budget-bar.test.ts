import { describe, expect, it } from "vite-plus/test";

import { BUDGET_SEGMENTS, buildBudgetBar } from "./budget-bar.js";
import type { TreasuryBreakdown } from "./treasury-summary.js";

const breakdown = (over: Partial<TreasuryBreakdown>): TreasuryBreakdown => ({
  income: 100,
  obligations: 10,
  fleetMaintenance: 20,
  researchSpend: 10,
  researchRequested: 10,
  researchCap: 12,
  researchUnfundedReason: undefined,
  plannedConstruction: 30,
  totalExpenditure: 40,
  projectedSurplusDeficit: 60,
  status: "healthy",
  shortfall: 0,
  availableFunds: 0,
  projectedMonthEndFunds: 60,
  runwayMonths: undefined,
  netExplanation: undefined,
  monthEndExplanation: undefined,
  runwayExplanation: undefined,
  appropriationExplanation: undefined,
  ...over,
});

describe("buildBudgetBar", () => {
  it("scales segments and the income marker to one shared width", () => {
    const bar = buildBudgetBar(breakdown({}));
    expect(bar.overBudget).toBe(false);
    expect(bar.incomeMarker).toBe(1);
    expect(bar.segments.map((s) => [s.id, s.width])).toEqual([
      ["obligations", 0.1],
      ["maintenance", 0.2],
      ["research", 0.1],
    ]);
    expect(bar.segments.map((s) => s.shareOfSpend)).toEqual([0.25, 0.5, 0.25]);
  });

  it("shows over-spending as the stack running past the income marker", () => {
    const bar = buildBudgetBar(
      breakdown({
        income: 50,
        obligations: 30,
        fleetMaintenance: 60,
        researchSpend: 10,
        totalExpenditure: 100,
      }),
    );
    expect(bar.overBudget).toBe(true);
    expect(bar.incomeMarker).toBe(0.5);
    expect(bar.overBudgetBy).toBe(50);
    expect(bar.segments.reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(1, 10);
  });

  it("copes with a zero budget without dividing by zero", () => {
    const bar = buildBudgetBar(
      breakdown({
        income: 0,
        obligations: 0,
        fleetMaintenance: 0,
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
      "Monthly budget: income 100; expenditure 40 (Obligations 10, Fleet maintenance 20, Research 10). Spending is within income.",
    );
  });

  it("names every segment and its colour token from one catalog", () => {
    expect(BUDGET_SEGMENTS.map((s) => s.id)).toEqual(["obligations", "maintenance", "research"]);
    const bar = buildBudgetBar(breakdown({}));
    expect(bar.segments.map((s) => [s.id, s.label, s.className])).toEqual(
      BUDGET_SEGMENTS.map((s) => [s.id, s.label, s.className]),
    );
  });
});

describe("buildBudgetBar preview", () => {
  it("widens the scale and reports the research delta without touching the committed figures", () => {
    const base = {
      income: 1000,
      obligations: 100,
      fleetMaintenance: 200,
      researchSpend: 100,
      totalExpenditure: 400,
    } as TreasuryBreakdown;
    const bar = buildBudgetBar(base, 700);
    const research = bar.segments.find((s) => s.id === "research");
    expect(research?.value).toBe(100);
    expect(research?.previewDelta).toBe(600);
    expect(bar.scale).toBe(1000);
    expect(research?.shareOfIncome).toBe(0.1);
    expect(buildBudgetBar(base).segments.every((s) => s.previewDelta === 0)).toBe(true);
  });
});
