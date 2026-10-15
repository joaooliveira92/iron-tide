import { CollapsiblePanel } from "../../../components/shared/CollapsiblePanel.js";
import type { MonthlyReportEntry } from "../../../../shared/campaign-command-contract.js";
import { MonthReportCard } from "../MonthReportCard.js";

/**
 * The home screen's "Recent developments" panel: a collapsible host that owns
 * only the panel chrome. The card owns the stored Monthly Naval Estimates
 * report content and the screen decides placement (CC-1, CC-2).
 */
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
