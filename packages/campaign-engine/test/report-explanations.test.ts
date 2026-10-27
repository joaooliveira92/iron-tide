import { describe, expect, it } from "vite-plus/test";
import { reconcileMonthLedger } from "../src/ledger-reconciliation.js";
import { explainReportTreasury } from "../src/report-explanations.js";

describe("report treasury explanation", () => {
  it("sums the reconciliation components to the closing balance", () => {
    const reconciliation = reconcileMonthLedger(
      [
        { categoryId: "NAVAL_APPROPRIATION", debit: 0, credit: 1_000 },
        { categoryId: "CONSTRUCTION_BUDGET", debit: 200, credit: 0 },
        { categoryId: "CONSTRUCTION_PRESERVATION", debit: 10, credit: 0 },
        { categoryId: "MAINTENANCE_EXPENDITURE", debit: 300, credit: 0 },
        { categoryId: "OBLIGATION", debit: 50, credit: 0 },
        { categoryId: "RESEARCH_EXPENDITURE", debit: 100, credit: 0 },
      ],
      500,
      845,
    );
    const tree = explainReportTreasury(reconciliation);
    expect(tree.formulaId).toBe("report_treasury");
    expect(Number(tree.result)).toBe(845);
    expect(tree.intermediate.netChange).toBe(345);
    const children = tree.children ?? [];
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(845);
    expect(children.map((child) => child.formulaId)).toEqual([
      "report_treasury.opening",
      "report_treasury.revenue",
      "report_treasury.construction",
      "report_treasury.preservation",
      "report_treasury.maintenance",
      "report_treasury.obligation",
      "report_treasury.research",
      "report_treasury.other",
    ]);
  });

  it("omits zero lines but still closes on the displayed balance", () => {
    const reconciliation = reconcileMonthLedger(
      [{ categoryId: "NAVAL_APPROPRIATION", debit: 0, credit: 100 }],
      0,
      100,
    );
    const tree = explainReportTreasury(reconciliation);
    expect(Number(tree.result)).toBe(100);
    expect(tree.children?.map((child) => child.formulaId)).toEqual([
      "report_treasury.opening",
      "report_treasury.revenue",
    ]);
  });
});
