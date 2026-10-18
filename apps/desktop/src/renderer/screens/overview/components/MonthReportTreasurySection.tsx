import type { MonthlyReportTreasury } from "../../../../shared/campaign-command-contract.js";
import { formatCount } from "../../../lib/presentation-format/index.js";
import { signed } from "../month-report-format.js";

const n = formatCount;

/** `opening 10 + revenue 3 − construction 4 …= closing 0`; a line that is zero is left out, `other` only when it moved. */
function reconciliationText(r: NonNullable<MonthlyReportTreasury["reconciliation"]>): string {
  const outflows: readonly (readonly [string, number])[] = [
    ["construction", r.construction],
    ["preservation", r.preservation],
    ["maintenance", r.maintenance],
    ["obligations", r.obligation],
    ["research", r.research],
  ];
  const spent = outflows
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => ` − ${label} ${n(value)}`);
  const other = r.other === 0 ? "" : ` ± other ${signed(r.other)}`;
  return `Reconciliation: opening ${n(r.opening)} + revenue ${n(r.revenue)}${spent.join("")}${other} = closing ${n(r.closing)}`;
}

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
        Treasury {formatCount(treasury.openingTreasury)} → {formatCount(treasury.closingTreasury)}{" "}
        <span className={treasury.netChange < 0 ? "text-destructive" : "text-success"}>
          ({signed(treasury.netChange)})
        </span>
      </p>
      <p className="text-muted-foreground">
        Fleet maintenance {formatCount(treasury.maintenanceCost)} · New construction{" "}
        {formatCount(treasury.constructionSpending)} · Research{" "}
        {formatCount(treasury.researchExpense)} · Naval appropriation{" "}
        {formatCount(treasury.governmentAllocation)}
        {treasury.obligationExpense === undefined
          ? ""
          : ` · Obligations ${n(treasury.obligationExpense)}`}
      </p>
      {treasury.reconciliation !== undefined && (
        <p className="text-muted-foreground">{reconciliationText(treasury.reconciliation)}</p>
      )}
      {treasury.ledgerRows.length > 0 && (
        <ul className="text-muted-foreground" aria-label="Financial ledger">
          {treasury.ledgerRows.map((row) => (
            <li key={row.id}>
              {row.description} ({signed(row.amount)})
              {row.requested !== undefined && (row.shortfall ?? 0) > 0 && (
                <span className="text-destructive">
                  {" "}
                  — requested {n(row.requested)}, paid {n(row.requested - (row.shortfall ?? 0))},
                  shortfall {n(row.shortfall ?? 0)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
