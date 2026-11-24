import type { DomainEventEnvelope } from "@bluewave/events";
import type { MonthlyReportNeutralWar } from "../../../shared/reports-contract.js";

export function neutralWarsFromEvents(
  events: readonly DomainEventEnvelope[],
  playerNationId: string,
): readonly MonthlyReportNeutralWar[] {
  const wars: MonthlyReportNeutralWar[] = [];
  for (const { body } of events) {
    if (body.kind !== "NeutralWarEntered") continue;
    if (body.nationId === playerNationId) {
      wars.push({
        role: "DECLARER",
        otherNationId: body.targetNationId,
        warId: body.warId,
        cause: body.cause,
        tension: Number(body.tension),
      });
    } else if (body.targetNationId === playerNationId) {
      wars.push({
        role: "TARGET",
        otherNationId: body.nationId,
        warId: body.warId,
        cause: body.cause,
        tension: Number(body.tension),
      });
    }
  }
  return wars;
}
