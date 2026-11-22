import type { NationState, Ship, TradeDutyDesign, TradeProtectionRules } from "@bluewave/campaign";
import type { RaiderEncounter } from "@bluewave/combat/generation";
import type { PhaseContext } from "./pipeline.js";
import { byId, shipsOf } from "./tradeWarContext.js";

export const PROVISIONAL_MAX_INTERCEPTORS = 4;

export interface RaiderEncounterRequest {
  readonly warId: string;
  readonly areaId: string;
  readonly breakout: boolean;
  readonly raiderNationId: string;
  readonly raiderShipId: string;
  readonly interceptorNation: NationState | undefined;
}

export function playerTakesPartInEncounter(
  ctx: PhaseContext,
  raiderNationId: string,
  interceptorNationId: string,
): boolean {
  return (
    ctx.interruption !== undefined &&
    ctx.battleOffers !== undefined &&
    ctx.playerNationId !== undefined &&
    (ctx.playerNationId === raiderNationId || ctx.playerNationId === interceptorNationId)
  );
}

function queuedShipIds(encounters: readonly RaiderEncounter[]): ReadonlySet<string> {
  return new Set(
    encounters.flatMap((encounter) => [encounter.raiderShipId, ...encounter.interceptorShipIds]),
  );
}

function isPatrolHull(
  rules: TradeProtectionRules,
  ship: Ship,
  design: TradeDutyDesign | undefined,
): boolean {
  if (design === undefined || !rules.contributingHullTypes.includes(design.hullType)) return false;
  if (ship.stationAssignment === "TRADE_PROTECTION") return true;
  return !rules.raiderHullTypes.includes(design.hullType);
}

export function selectInterceptors(
  rules: TradeProtectionRules,
  nation: NationState,
  designs: ReadonlyMap<string, TradeDutyDesign>,
  taken: ReadonlySet<string>,
): readonly string[] {
  return shipsOf(nation)
    .filter(
      (ship) =>
        !ship.isUnderConstruction &&
        ship.readiness === "ACTIVE" &&
        ship.internment === undefined &&
        ship.inBattleId === undefined &&
        ship.stationAssignment !== "RAIDER" &&
        !taken.has(ship.id) &&
        isPatrolHull(rules, ship, designs.get(ship.designVersionId)),
    )
    .sort(
      (a, b) =>
        Number(b.stationAssignment === "TRADE_PROTECTION") -
          Number(a.stationAssignment === "TRADE_PROTECTION") || byId(a.id, b.id),
    )
    .slice(0, PROVISIONAL_MAX_INTERCEPTORS)
    .map((ship) => ship.id);
}

export function queueRaiderEncounter(
  ctx: PhaseContext,
  rules: TradeProtectionRules,
  designs: ReadonlyMap<string, TradeDutyDesign>,
  request: RaiderEncounterRequest,
): boolean {
  const { interceptorNation } = request;
  if (interceptorNation === undefined) return false;
  if (!playerTakesPartInEncounter(ctx, request.raiderNationId, interceptorNation.id)) return false;
  const queue = ctx.raiderEncounters;
  if (queue === undefined) return false;
  const interceptorShipIds = selectInterceptors(
    rules,
    interceptorNation,
    designs,
    queuedShipIds(queue),
  );
  if (interceptorShipIds.length === 0) return false;
  queue.push({
    missionType: request.breakout ? "BLOCKADE_BREAKOUT" : "RAIDER_INTERCEPTION",
    warId: request.warId,
    areaId: request.areaId,
    raiderNationId: request.raiderNationId,
    raiderShipId: request.raiderShipId,
    interceptorNationId: interceptorNation.id,
    interceptorShipIds,
  });
  return true;
}
