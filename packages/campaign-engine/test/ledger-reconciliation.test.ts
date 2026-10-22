import { describe, expect, it } from "vite-plus/test";
import { reconcileMonthLedger } from "../src/ledger-reconciliation.js";

const row = (categoryId: string, debit: number, credit = debit) => ({ categoryId, debit, credit });

describe("reconcileMonthLedger", () => {
  it("closes: closing = opening + revenue - construction - preservation - maintenance - obligation - research", () => {
    const r = reconcileMonthLedger(
      [
        row("NAVAL_APPROPRIATION", 100),
        row("APPROPRIATION", 4),
        row("CONSTRUCTION_PRESERVATION", 1),
        row("MAINTENANCE_EXPENDITURE", 16),
        row("OBLIGATION", 38),
        row("RESEARCH_EXPENDITURE", 5),
      ],
      500,
      536,
    );
    expect(r).toEqual({
      opening: 500,
      revenue: 100,
      construction: 4,
      preservation: 1,
      maintenance: 16,
      obligation: 38,
      research: 5,
      other: 0,
      closing: 536,
    });
  });

  it("sums repeated lines of one category and counts an explicit player budget as construction", () => {
    const r = reconcileMonthLedger(
      [
        row("NAVAL_APPROPRIATION", 10),
        row("OBLIGATION", 3),
        row("OBLIGATION", 2),
        row("CONSTRUCTION_BUDGET", 1),
      ],
      100,
      104,
    );
    expect(r.obligation).toBe(5);
    expect(r.construction).toBe(1);
    expect(r.other).toBe(0);
  });

  it("books every other treasury movement as one signed line so the identity still closes", () => {
    const r = reconcileMonthLedger(
      [row("NAVAL_APPROPRIATION", 50), row("FOREIGN_PAYMENT", 7)],
      100,
      143,
    );
    expect(r.other).toBe(-7);
    expect(
      r.opening +
        r.revenue -
        r.construction -
        r.preservation -
        r.maintenance -
        r.obligation -
        r.research +
        r.other,
    ).toBe(r.closing);
  });
});
