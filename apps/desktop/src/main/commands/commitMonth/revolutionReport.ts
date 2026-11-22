import type { DomainEventEnvelope } from "@bluewave/events";
import type { MonthlyReportRevolution } from "../../../shared/reports-contract.js";

export function foreignRevolutionsFromEvents(
  events: readonly DomainEventEnvelope[],
  playerNationId: string,
): readonly MonthlyReportRevolution[] {
  const revolutions: MonthlyReportRevolution[] = [];
  for (const { body } of events) {
    if (
      body.kind === "UnrestConsequence" &&
      body.consequence === "REVOLUTION" &&
      body.nationId !== playerNationId &&
      body.governmentBefore !== undefined &&
      body.governmentAfter !== undefined
    ) {
      revolutions.push({
        nationId: body.nationId,
        governmentBefore: body.governmentBefore,
        governmentAfter: body.governmentAfter,
      });
    }
  }
  return revolutions;
}
