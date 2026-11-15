import type { MonthlyReportPresence } from "../../../../shared/reports-contract.js";
import { translate } from "../../../lib/strings.js";
import { format } from "../../fleet/station/fleet-station-state.js";
import { SummaryList, SummaryRow, SummarySection } from "./summary/index.js";

export function MonthReportPresenceSection({
  presence,
  areaName,
}: {
  readonly presence: MonthlyReportPresence;
  readonly areaName: (id: string) => string;
}) {
  return (
    <SummarySection
      variant="report"
      ariaLabel={translate("reports.presence.title")}
      className="space-y-1"
      title={translate("reports.presence.title")}
    >
      {presence.prestigeDelta === undefined ? null : (
        <p className="text-destructive" data-testid="month-report-presence-prestige">
          {format("reports.presence.prestige", { delta: presence.prestigeDelta })}
        </p>
      )}
      <SummaryList variant="report" ariaLabel={translate("reports.presence.title")}>
        {presence.shortfalls.map((row) => (
          <SummaryRow key={row.areaId} variant="report">
            {format("reports.presence.row", {
              station: areaName(row.areaId),
              present: row.presentTons,
              required: row.requiredTons,
              shortfall: row.shortfallTons,
            })}
          </SummaryRow>
        ))}
      </SummaryList>
    </SummarySection>
  );
}
