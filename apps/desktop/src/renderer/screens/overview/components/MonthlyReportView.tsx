import type { MonthlyReportEntry } from "../../../../shared/campaign-command-contract.js";
import { MonthReportBattleOutcomesSection } from "./MonthReportBattleOutcomesSection.js";
import { MonthReportConstructionSection } from "./MonthReportConstructionSection.js";
import { MonthReportFleetSection } from "./MonthReportFleetSection.js";
import { MonthReportPrioritiesSection } from "./MonthReportPrioritiesSection.js";
import { MonthReportResearchSection } from "./MonthReportResearchSection.js";
import { MonthReportTreasurySection } from "./MonthReportTreasurySection.js";

/**
 * One stored month's Monthly Naval Estimates report (spec §16): Treasury,
 * Construction, Research, Fleet, Priorities and a dedicated Battle Outcomes
 * subsection. `previous` is the report for the month before it (older), used
 * only for the Priorities new/resolved/continuing comparison.
 */
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
      <MonthReportConstructionSection construction={report.construction} />
      <MonthReportResearchSection research={report.research} />
      <MonthReportFleetSection fleet={report.fleet} />
      <MonthReportPrioritiesSection
        priorities={report.priorities}
        previousPriorities={previous?.priorities ?? []}
      />
      <MonthReportBattleOutcomesSection battles={report.battleOutcomes} areaName={areaName} />
    </div>
  );
}
