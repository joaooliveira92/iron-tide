import type { MonthlyReportEntry } from "../../../../shared/reports-contract.js";
import { monthLabel } from "../month-report-format.js";
import { NarrativeMonthSummary } from "../NarrativeMonthSummary.js";
import { MonthReportTreasurySection } from "./MonthReportTreasurySection.js";

export function MonthlyReportView({
  report,
  previous,
  areaName,
}: {
  readonly report: MonthlyReportEntry;
  readonly previous: MonthlyReportEntry | undefined;
  readonly areaName: (id: string) => string;
}) {
  return (
    <div className="space-y-3" data-testid="monthly-report">
      <MonthReportTreasurySection treasury={report.treasury} />
      <NarrativeMonthSummary reports={[report]} areaName={areaName} />
      {previous !== undefined && (
        <details className="mt-4">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Previous month ({monthLabel(previous.period.from)})
          </summary>
          <div className="mt-2 space-y-3 pl-4 border-l-2 border-border">
            <NarrativeMonthSummary reports={[previous]} areaName={areaName} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Earlier months are kept with this campaign.
          </p>
        </details>
      )}
    </div>
  );
}
