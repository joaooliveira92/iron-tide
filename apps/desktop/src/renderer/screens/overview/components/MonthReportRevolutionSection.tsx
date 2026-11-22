import type { MonthlyReportRevolution } from "../../../../shared/reports-contract.js";
import { campaignNationLabel } from "../../../content/presentationContent.js";
import { hasAuthoredMessage, translate } from "../../../lib/strings.js";
import { SummaryList, SummarySection } from "./summary/index.js";

function governmentLabel(government: string): string {
  const key = `reports.revolution.government.${government}`;
  return hasAuthoredMessage(key) ? translate(key) : government;
}

export function MonthReportRevolutionSection({
  revolutions,
}: {
  readonly revolutions: readonly MonthlyReportRevolution[];
}) {
  return (
    <SummarySection
      variant="report"
      ariaLabel={translate("reports.revolution.title")}
      className="space-y-1"
      title={translate("reports.revolution.title")}
    >
      <SummaryList variant="report" ariaLabel={translate("reports.revolution.title")}>
        {revolutions.map((entry, index) => (
          <li key={`${entry.nationId}-${index}`} data-testid="month-report-revolution">
            {translate("reports.revolution.line", {
              nation: campaignNationLabel(entry.nationId),
              before: governmentLabel(entry.governmentBefore),
              after: governmentLabel(entry.governmentAfter),
            })}
          </li>
        ))}
      </SummaryList>
    </SummarySection>
  );
}
