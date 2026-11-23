import {
  battleReadiness,
  type NationState,
  type Ship,
  type TradeDutyDesign,
  type TradeProtectionRules,
} from "@bluewave/campaign";
import { BATTLE_READINESS_FLOOR, queuedEncounterShipIds } from "@bluewave/combat/generation";
import type { PhaseContext } from "./pipeline.js";
import { byId } from "./tradeWarContext.js";

export const PROVISIONAL_MAX_INTERCEPTORS = 4;

export interface RaiderEncounterRequest {
  readonly warId: string;
  readonly areaId: string;
  readonly breakout: boolean;
  readonly raiderNationId: string;
  readonly raiderShip: Ship;
  readonly interceptorNation: NationState | undefined;
  readonly drawShortRangeStartUm?: () => number | undefined;
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

function canBeBuiltIntoBattle(ship: Ship): boolean {
  return (
    ship.readiness !== "WORKING_UP" &&
    ship.readiness !== "RESERVE" &&
    ship.readiness !== "MOTHBALLED" &&
    battleReadiness(ship.crewQuality) >= BATTLE_READINESS_FLOOR
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
  areaId: string,
): readonly string[] {
  return nation.fleets
    .filter((fleet) => fleet.locationAreaId === areaId)
    .flatMap((fleet) => fleet.ships)
    .filter(
      (ship) =>
        !ship.isUnderConstruction &&
        ship.readiness === "ACTIVE" &&
        canBeBuiltIntoBattle(ship) &&
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
    .slice(0, rules.raiderInterception?.maxInterceptors ?? PROVISIONAL_MAX_INTERCEPTORS)
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
  if (queue === undefined || !canBeBuiltIntoBattle(request.raiderShip)) return false;
  const interceptorShipIds = selectInterceptors(
    rules,
    interceptorNation,
    designs,
    queuedEncounterShipIds(queue),
    request.areaId,
  );
  if (interceptorShipIds.length === 0) return false;
  const shortRangeStartUm = request.drawShortRangeStartUm?.();
  queue.push({
    ...(shortRangeStartUm === undefined ? {} : { shortRangeStartUm }),
    missionType: request.breakout ? "BLOCKADE_BREAKOUT" : "RAIDER_INTERCEPTION",
    warId: request.warId,
    areaId: request.areaId,
    raiderNationId: request.raiderNationId,
    raiderShipId: request.raiderShip.id,
    interceptorNationId: interceptorNation.id,
    interceptorShipIds,
  });
  return true;
}
