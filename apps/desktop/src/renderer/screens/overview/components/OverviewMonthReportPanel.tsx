import { CollapsiblePanel } from "../../../components/shared/CollapsiblePanel.js";
import type { MonthlyReportEntry } from "../../../../shared/reports-contract.js";
import { MonthReportCard } from "../MonthReportCard.js";

export function OverviewMonthReportPanel({
  reports,
  areaName,
  defaultOpen,
}: {
  readonly reports: readonly MonthlyReportEntry[];
  readonly areaName: (id: string) => string;
  readonly defaultOpen: boolean;
}) {
  return (
    <CollapsiblePanel
      panelId="home-month-report"
      title="Recent developments"
      defaultOpen={defaultOpen}
      testId="home-month-report"
    >
      <MonthReportCard reports={reports} areaName={areaName} embedded />
    </CollapsiblePanel>
  );
}
