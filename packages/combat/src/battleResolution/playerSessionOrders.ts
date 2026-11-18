import { BluewaveError } from "@bluewave/contracts";
import type { TacticalDivision } from "../tactical/division.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { UnitOrders } from "../simulation/engine.js";
import { headingToward } from "./engagement.js";
import { pursuitOrders } from "./pursuit.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import {
  DIVISION_ORDER_MAX_HEADING_DEG,
  DIVISION_ORDER_MAX_KNOTS,
  WAYPOINT_MAX_METRES,
  compileDivisionOrders,
  divisionOrdersFromLegacy,
  type DivisionNavigation,
  type DivisionOrderSet,
  type DivisionSpeed,
} from "../orders/index.js";
import type {
  PlayerBattleDivisionOrder,
  PlayerBattleOrders,
  PlayerBattleSession,
  PlayerBattleStance,
  PlayerBattleWaypoint,
} from "./playerSessionTypes.js";

function clampSpeedPercent(value: number): number {
  if (!Number.isInteger(value)) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: "speedPercent must be an integer",
      value,
    });
  }
  return Math.min(100, Math.max(0, value));
}

function requireInteger(field: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: `${field} must be an integer from ${String(minimum)} to ${String(maximum)}`,
      value,
    });
  }
  return value;
}

export function validatedWaypoint(order: PlayerBattleDivisionOrder): PlayerBattleWaypoint | null {
  const waypoint = order.waypoint;
  if (waypoint === undefined) return null;
  if (order.courseDeg !== undefined) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: "a division order carries a course or a waypoint, not both",
    });
  }
  requireInteger("waypoint.xMetres", waypoint.xMetres, -WAYPOINT_MAX_METRES, WAYPOINT_MAX_METRES);
  requireInteger("waypoint.yMetres", waypoint.yMetres, -WAYPOINT_MAX_METRES, WAYPOINT_MAX_METRES);
  return waypoint;
}

function divisionOrderSet(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
  divisions: readonly TacticalDivision[],
): DivisionOrderSet {
  const legacy: Record<string, { stance: PlayerBattleStance; speedPercent: number }> = {};
  for (const [divisionId, order] of Object.entries(orders.divisions)) {
    legacy[divisionId] = {
      stance: order.stance,
      speedPercent: clampSpeedPercent(order.speedPercent),
    };
  }
  const base = divisionOrdersFromLegacy({ divisions: legacy }, divisions);
  return {
    ...base,
    divisions: base.divisions.map((entry) => {
      const requested = orders.divisions[entry.divisionId]!;
      const waypoint = validatedWaypoint(requested);
      const arrival = session.waypointArrivals?.[entry.divisionId];
      const consumed =
        waypoint !== null &&
        arrival !== undefined &&
        arrival.xMetres === waypoint.xMetres &&
        arrival.yMetres === waypoint.yMetres;
      let navigation: DivisionNavigation = entry.navigation;
      if (requested.courseDeg !== undefined) {
        navigation = {
          kind: "COURSE",
          headingDeg: requireInteger(
            "courseDeg",
            requested.courseDeg,
            0,
            DIVISION_ORDER_MAX_HEADING_DEG,
          ),
        };
      } else if (waypoint !== null) {
        navigation = consumed
          ? { kind: "COURSE", headingDeg: arrival.headingDeg }
          : {
              kind: "WAYPOINT",
              xMetres: waypoint.xMetres,
              yMetres: waypoint.yMetres,
              pauseOnArrival: waypoint.pauseOnArrival,
            };
      }
      const speed: DivisionSpeed =
        requested.speedKnots === undefined
          ? entry.speed
          : {
              kind: "KNOTS",
              knots: requireInteger(
                "speedKnots",
                requested.speedKnots,
                1,
                DIVISION_ORDER_MAX_KNOTS,
              ),
            };
      return { ...entry, navigation, speed };
    }),
  };
}

function headingAway(session: PlayerBattleSession, unit: TacticalShipUnit): number | null {
  const movement = session.state.movementStates?.[unit.assetId];
  if (!movement) return null;
  const contacts = new Map(
    (session.state.contacts ?? []).map((contact) => [contact.contactId, contact.position] as const),
  );
  const live = (shipId: string): boolean =>
    (session.damage.targets[shipId]?.state.terminalStatus ?? "NORMAL") === "NORMAL";
  let nearest: readonly [number, number] | null = null;
  let bestD2 = Number.POSITIVE_INFINITY;
  for (const enemy of session.units) {
    if (enemy.sideId === unit.sideId || !live(enemy.assetId)) continue;
    const position = contacts.get(`${session.battleId}:${enemy.assetId}`);
    if (!position) continue;
    const dx = position[0] - movement.position[0];
    const dy = position[1] - movement.position[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      nearest = position;
    }
  }
  if (!nearest) return null;
  return (
    (headingToward(nearest[0] - movement.position[0], nearest[1] - movement.position[1]) + 180) %
    360
  );
}

export function resolveOrders(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
  adjust?: (set: DivisionOrderSet) => DivisionOrderSet,
): Record<string, UnitOrders> {
  const base = divisionOrderSet(session, orders, session.state.divisions);
  const pursuit = pursuitOrders({
    battleId: session.battleId,
    battleState: session.state,
    damage: session.damage,
    units: session.units,
    baseOrders: session.baseOrders,
  });
  return compileDivisionOrders({
    orders: adjust === undefined ? base : adjust(base),
    units: session.units,
    divisions: session.state.divisions,
    baseOrders: session.baseOrders,
    movement: session.state.movementStates ?? {},
    pursuit,
    headingAway: (unit) => headingAway(session, unit),
  }).unitOrders;
}
