import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { HistoryMonth } from "../history-view.js";
import { signed } from "../../overview/month-report-format.js";

export function MonthLedger({ month }: { readonly month: HistoryMonth }) {
  const format = usePresentationFormat();
  const r = month.reconciliation;
  const steps =
    r === undefined
      ? []
      : [
          { label: "Opening treasury", value: format.count(r.opening) },
          { label: "Appropriation", value: signed(r.revenue, format) },
          { label: "Construction", value: signed(-r.construction, format) },
          { label: "Preservation", value: signed(-r.preservation, format) },
          { label: "Maintenance", value: signed(-r.maintenance, format) },
          { label: "Obligations", value: signed(-r.obligation, format) },
          { label: "Research", value: signed(-r.research, format) },
          { label: "Other", value: signed(r.other, format) },
        ].filter((step) => step.label === "Opening treasury" || step.value !== "0");

  return (
    <section aria-label={`${month.label} ledger`} className="space-y-3" data-testid="month-ledger">
      <h4 className="flex flex-wrap items-baseline gap-x-3 text-base font-medium tracking-tight">
        {month.label}
        <span className="text-sm font-normal text-muted-foreground">
          {format.count(month.opening)} → {format.count(month.closing)}{" "}
          <span className={month.net < 0 ? "text-destructive" : "text-success"}>
            ({signed(month.net, format)})
          </span>
        </span>
      </h4>
      {r !== undefined && (
        <dl className="grid max-w-sm gap-y-0.5 text-sm">
          {steps.map((step) => (
            <div key={step.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{step.label}</dt>
              <dd className="tabular-nums">{step.value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t pt-0.5 font-medium">
            <dt>Closing treasury</dt>
            <dd className="tabular-nums">{format.count(r.closing)}</dd>
          </div>
        </dl>
      )}
      {month.ledger.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ledger entries were recorded this month.</p>
      ) : (
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {month.ledger.map((row) => {
              const short = row.shortfall ?? 0;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.description}
                    {row.requested !== undefined && short > 0 && (
                      <span className="block text-xs text-destructive">
                        Requested {format.count(row.requested)}, paid{" "}
                        {format.count(row.requested - short)}, left unpaid {format.count(short)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      row.amount < 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {signed(row.amount, format)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.count(row.runningBalance)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
