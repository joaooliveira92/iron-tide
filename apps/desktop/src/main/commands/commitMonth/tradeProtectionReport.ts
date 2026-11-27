import type { DomainEventEnvelope } from "@bluewave/events";
import type {
  MonthlyReportRaiderEntry,
  MonthlyReportTradeProtection,
  MonthlyReportWarshipAttackEntry,
} from "../../../shared/reports-contract.js";

export type ShipNameLookup = (shipId: string) => string | undefined;

const NO_NAMES: ShipNameLookup = () => undefined;

export function tradeProtectionFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
  shipName: ShipNameLookup = NO_NAMES,
): MonthlyReportTradeProtection | undefined {
  let assessed:
    | Omit<MonthlyReportTradeProtection, "loss" | "raiders" | "warshipAttacks">
    | undefined;
  let loss: MonthlyReportTradeProtection["loss"];
  const raiders: MonthlyReportRaiderEntry[] = [];
  const warshipAttacks: MonthlyReportWarshipAttackEntry[] = [];
  const named = (shipId: string) => {
    const name = shipName(shipId);
    return name === undefined || name.length === 0 ? { shipId } : { shipId, shipName: name };
  };
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
        submarineHits: Number(body.submarineHits),
        pressureHit: body.pressureHit,
        lossBp: Number(body.lossBp),
        poolBefore: Number(body.poolBefore),
        poolAfter: Number(body.poolAfter),
      };
    } else if (body.kind === "RaiderEngaged" && body.nationId === nationId) {
      raiders.push({
        ...named(body.shipId),
        event: "ENGAGED",
        encounter: body.encounter,
        victimNationId: body.victimNationId,
        outcome: body.outcome,
      });
    } else if (body.kind === "RaiderInterned" && body.nationId === nationId) {
      raiders.push({ ...named(body.shipId), event: "INTERNED", cause: body.cause });
    } else if (body.kind === "RaiderReleased" && body.nationId === nationId) {
      raiders.push({ ...named(body.shipId), event: "RELEASED" });
    } else if (body.kind === "SubmarineWarshipAttacked" && body.victimNationId === nationId) {
      const victimShipName = shipName(body.victimShipId);
      warshipAttacks.push({
        nationId: body.nationId,
        boatId: body.boatId,
        victimShipId: body.victimShipId,
        ...(victimShipName === undefined || victimShipName.length === 0 ? {} : { victimShipName }),
        outcome: body.outcome,
        damageBp: Number(body.damageBp),
      });
    }
  }
  if (assessed === undefined) return undefined;
  return {
    ...assessed,
    ...(loss === undefined ? {} : { loss }),
    ...(raiders.length === 0 ? {} : { raiders }),
    ...(warshipAttacks.length === 0 ? {} : { warshipAttacks }),
  };
}
