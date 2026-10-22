import { Info } from "lucide-react";
import type { MonthlyReportEntry } from "../../../shared/campaign-command-contract.js";
import { CardShell } from "../../components/shared/CardShell.js";
import { CardDescription, CardTitle } from "../../components/ui/card.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { monthLabel } from "./month-report-format.js";
import { MonthlyReportView } from "./components/MonthlyReportView.js";

export function MonthReportCard({
  reports,
  areaName = humanizeId,
  embedded = false,
}: {
  readonly reports: readonly MonthlyReportEntry[];
  readonly areaName?: (id: string) => string;
  readonly embedded?: boolean;
}) {
  const [latest, ...earlier] = reports;
  const description =
    latest === undefined
      ? "The monthly report appears here after you advance the month."
      : `Report for ${monthLabel(latest.period.from)}.`;
  return (
    <CardShell
      testId="month-report-card"
      embedded={embedded}
      header={
        <>
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            <Info className="h-4 w-4 text-muted-foreground" />
            Recent Developments
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </>
      }
      contentClassName="space-y-3 text-xs"
    >
      {embedded && <p className="text-muted-foreground">{description}</p>}
      {latest === undefined ? (
        <p className="text-muted-foreground">No months have been advanced yet in this campaign.</p>
      ) : (
        <MonthlyReportView report={latest} previous={earlier[0]} areaName={areaName} />
      )}
      {earlier.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            Earlier months ({earlier.length})
          </summary>
          <ul className="mt-2 space-y-3">
            {earlier.map((report, index) => (
              <li
                key={`${report.period.from.year}-${report.period.from.month}`}
                className="space-y-1"
              >
                <p className="font-medium">{monthLabel(report.period.from)}</p>
                <MonthlyReportView
                  report={report}
                  previous={earlier[index + 1]}
                  areaName={areaName}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">Earlier months are kept with this campaign.</p>
        </details>
      )}
    </CardShell>
  );
}
