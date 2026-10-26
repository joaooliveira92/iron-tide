import { useMemo, useState } from "react";

import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { useMonthlyReports } from "../../overview/useMonthlyReports.js";
import { signed } from "../../overview/month-report-format.js";
import { buildHistory } from "../history-view.js";
import { HistoryChart } from "./HistoryChart.js";
import { MonthLedger } from "./MonthLedger.js";

export function HistoryTab({ sessionId }: { readonly sessionId: string }) {
  const format = usePresentationFormat();
  const { reports, loading } = useMonthlyReports(sessionId);
  const history = useMemo(() => buildHistory(reports), [reports]);
  const [picked, setPicked] = useState<string | null>(null);
  const { months } = history;
  const first = months[0];
  const last = months[months.length - 1];
  const selected = months.find((month) => month.id === picked) ?? last;

  if (first === undefined || last === undefined || selected === undefined)
    return (
      <p data-testid="history-empty" className="text-base font-medium tracking-tight">
        {loading
          ? "Loading the treasury record."
          : "No month has closed yet. Advance the month and its accounts will appear here."}
      </p>
    );

  const moved = last.closing - first.opening;
  return (
    <div className="space-y-6" data-testid="treasury-history">
      <p className="text-base font-medium tracking-tight">
        Over {months.length === 1 ? "the last month" : `the last ${months.length} months`} the
        treasury went from {format.count(first.opening)} to {format.count(last.closing)} (
        {signed(moved, format)}).
      </p>
      <HistoryChart history={history} selectedId={selected.id} onSelect={setPicked} />
      {history.hiddenEarlier > 0 && (
        <p className="text-xs text-muted-foreground">
          {format.count(history.hiddenEarlier)} earlier{" "}
          {history.hiddenEarlier === 1 ? "month is" : "months are"} not shown.
        </p>
      )}
      <MonthLedger month={selected} />
    </div>
  );
}
