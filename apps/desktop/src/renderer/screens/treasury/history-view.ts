import type {
  MonthlyReportEntry,
  MonthlyReportLedgerRow,
  MonthlyReportTreasury,
} from "../../../shared/reports-contract.js";
import { monthLabel } from "../overview/month-report-format.js";

export const HISTORY_MONTHS = 24;

export interface HistoryMonth {
  readonly id: string;
  readonly turn: number;
  readonly label: string;
  readonly opening: number;
  readonly closing: number;
  readonly net: number;
  readonly income: number;
  readonly obligations: number;
  readonly maintenance: number;
  readonly research: number;
  readonly construction: number;
  readonly spent: number;
  readonly shortfall: number;
  readonly ledger: readonly MonthlyReportLedgerRow[];
  readonly reconciliation: MonthlyReportTreasury["reconciliation"];
  readonly centre: number;
  readonly cashY: number;
}

export interface History {
  readonly months: readonly HistoryMonth[];
  readonly hiddenEarlier: number;
  readonly spendScale: number;
}

export function buildHistory(
  reports: readonly MonthlyReportEntry[],
  limit: number = HISTORY_MONTHS,
): History {
  const ordered = [...reports].sort((a, b) => a.turn - b.turn);
  const shown = ordered.slice(Math.max(0, ordered.length - limit));
  const closings = shown.map((report) => report.treasury.closingTreasury);
  const low = Math.min(...closings);
  const high = Math.max(...closings);
  const months = shown.map((report, index): HistoryMonth => {
    const t = report.treasury;
    const obligations = t.obligationExpense ?? 0;
    return {
      id: report.reportId,
      turn: report.turn,
      label: monthLabel(report.period.to),
      opening: t.openingTreasury,
      closing: t.closingTreasury,
      net: t.netChange,
      income: t.governmentAllocation,
      obligations,
      maintenance: t.maintenanceCost,
      research: t.researchExpense,
      construction: t.constructionSpending,
      spent: obligations + t.maintenanceCost + t.researchExpense + t.constructionSpending,
      shortfall: t.ledgerRows.reduce((sum, row) => sum + (row.shortfall ?? 0), 0),
      ledger: t.ledgerRows,
      reconciliation: t.reconciliation,
      centre: (index + 0.5) / shown.length,
      cashY: high === low ? 0.5 : (high - t.closingTreasury) / (high - low),
    };
  });
  return {
    months,
    hiddenEarlier: ordered.length - shown.length,
    spendScale: Math.max(1, ...months.map((month) => Math.max(month.income, month.spent))),
  };
}
