import type { MonthlyReportTreasury } from "../../../../shared/campaign-command-contract.js";
import { signed } from "../month-report-format.js";

/**
 * The report's Treasury section (spec §16): the real `MonthReport` plus the two
 * ledger-derived lines and the real ledger rows — no invented balancing row.
 * There is no per-ship maintenance effect (CUT).
 */
export function MonthReportTreasurySection({
  treasury,
}: {
  readonly treasury: MonthlyReportTreasury;
}) {
  return (
    <section aria-label="Treasury" className="space-y-1">
      <p className="font-medium">
        Treasury {treasury.openingTreasury.toLocaleString()} →{" "}
        {treasury.closingTreasury.toLocaleString()}{" "}
        <span className={treasury.netChange < 0 ? "text-destructive" : "text-success"}>
          ({signed(treasury.netChange)})
        </span>
      </p>
      <p className="text-muted-foreground">
        Fleet maintenance {treasury.maintenanceCost.toLocaleString()} · New construction{" "}
        {treasury.constructionSpending.toLocaleString()} · Research{" "}
        {treasury.researchExpense.toLocaleString()} · Naval appropriation{" "}
        {treasury.governmentAllocation.toLocaleString()}
      </p>
      {treasury.ledgerRows.length > 0 && (
        <ul className="text-muted-foreground" aria-label="Financial ledger">
          {treasury.ledgerRows.map((row) => (
            <li key={row.id}>
              {row.description} ({signed(row.amount)})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
