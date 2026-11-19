import type { DomainEventEnvelope } from "@bluewave/events";
import type { MonthlyReportTradeProtection } from "../../../shared/reports-contract.js";

export function tradeProtectionFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): MonthlyReportTradeProtection | undefined {
  let assessed: Omit<MonthlyReportTradeProtection, "loss"> | undefined;
  let loss: MonthlyReportTradeProtection["loss"];
  for (const { body } of events) {
    if (body.kind === "TradeProtectionAssessed" && body.nationId === nationId) {
      assessed = {
        quota: Number(body.quota),
        assigned: Number(body.assigned),
        shortfall: Number(body.shortfall),
        shortfallBp: Number(body.shortfallBp),
      };
    } else if (body.kind === "MerchantLossSuffered" && body.nationId === nationId) {
      loss = {
        raiderHits: Number(body.raiderHits),
        pressureHit: body.pressureHit,
        lossBp: Number(body.lossBp),
        poolBefore: Number(body.poolBefore),
        poolAfter: Number(body.poolAfter),
      };
    }
  }
  if (assessed === undefined) return undefined;
  return { ...assessed, ...(loss === undefined ? {} : { loss }) };
}
