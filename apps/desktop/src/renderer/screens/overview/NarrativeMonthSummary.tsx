"use strict";

import { useMemo, useState } from "react";
import type { MonthlyReportEntry } from "../../../shared/reports-contract.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { narrativeMonthSummary } from "./narrative-month-summary.js";
import { monthLabel } from "./month-report-format.js";

export function NarrativeMonthSummary({
  reports,
  areaName,
}: {
  readonly reports: readonly MonthlyReportEntry[];
  readonly areaName?: (id: string) => string;
}) {
  const format = usePresentationFormat();
  const latest = reports[0];
  const earlier = useMemo(() => reports.slice(1), [reports]);
  const description =
    latest === undefined
      ? "The narrative month report appears here after you advance the month."
      : `Narrative summary for ${monthLabel(latest.period.from)}.`;

  const [earlierOpen, setEarlierOpen] = useState(false);
  const resolveAreaName = areaName ?? humanizeId;
  const narrative = useMemo(
    () =>
      latest === undefined
        ? null
        : narrativeMonthSummary(latest, earlier[0], resolveAreaName, format),
    [latest, earlier, resolveAreaName, format],
  );

  if (latest === undefined || narrative === null) {
    return (
      <div className="space-y-4 text-sm leading-relaxed">
        <p className="text-muted-foreground italic">{description}</p>
        <p className="text-muted-foreground">No months have been advanced yet in this campaign.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p className="text-muted-foreground italic">{description}</p>
      <p className="whitespace-pre-line text-foreground">{narrative}</p>

      {earlier.length > 0 && (
        <details className="mt-4" onToggle={(event) => setEarlierOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Earlier months ({earlier.length})
          </summary>
          {earlierOpen ? (
            <EarlierMonths earlier={earlier} areaName={resolveAreaName} format={format} />
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Earlier months are kept with this campaign.
          </p>
        </details>
      )}
    </div>
  );
}

function EarlierMonths({
  earlier,
  areaName,
  format,
}: {
  readonly earlier: readonly MonthlyReportEntry[];
  readonly areaName: (id: string) => string;
  readonly format: PresentationFormat;
}) {
  const entries = useMemo(
    () =>
      earlier.map((report, index) => ({
        key: `${report.period.from.year}-${report.period.from.month}`,
        heading: monthLabel(report.period.from),
        text: narrativeMonthSummary(report, earlier[index + 1], areaName, format),
      })),
    [earlier, areaName, format],
  );
  return (
    <ul className="mt-2 space-y-3 pl-4 border-l-2 border-border">
      {entries.map((entry) => (
        <li key={entry.key} className="space-y-1">
          <p className="font-medium text-xs">{entry.heading}</p>
          <p className="whitespace-pre-line text-xs text-muted-foreground">{entry.text}</p>
        </li>
      ))}
    </ul>
  );
}
