import type { MonthlyReportFleetExercise } from "../../../../shared/reports-contract.js";
import { campaignNationLabel } from "../../../content/presentationContent.js";
import { translate } from "../../../lib/strings.js";
import { SummaryList, SummaryRow, SummarySection } from "./summary/index.js";

export function MonthReportExerciseSection({
  exercise,
}: {
  readonly exercise: MonthlyReportFleetExercise;
}) {
  const { scheduled, completed, tension } = exercise;
  return (
    <SummarySection
      variant="report"
      ariaLabel={translate("reports.exercise.title")}
      className="space-y-1"
      title={translate("reports.exercise.title")}
    >
      <SummaryList variant="report" ariaLabel={translate("reports.exercise.title")}>
        {scheduled === undefined ? null : (
          <SummaryRow variant="report">
            {translate(
              scheduled.shipIds.length === 1
                ? "reports.exercise.scheduled.one"
                : "reports.exercise.scheduled.many",
              { month: scheduled.month, n: scheduled.shipIds.length },
            )}
          </SummaryRow>
        )}
        {completed === undefined ? null : (
          <SummaryRow variant="report">
            {translate(
              completed.shipIds.length === 1
                ? "reports.exercise.completed.one"
                : "reports.exercise.completed.many",
              {
                month: completed.month,
                n: completed.shipIds.length,
                experience: completed.experienceGained,
              },
            )}
          </SummaryRow>
        )}
        {completed !== undefined && tension.length === 0 ? (
          <SummaryRow variant="report">{translate("reports.exercise.noTension")}</SummaryRow>
        ) : null}
        {tension.map((row) => (
          <SummaryRow key={row.otherNationId} variant="report">
            {translate("reports.exercise.tension", {
              nation: campaignNationLabel(row.otherNationId),
              before: row.before,
              after: row.after,
            })}
          </SummaryRow>
        ))}
      </SummaryList>
    </SummarySection>
  );
}
