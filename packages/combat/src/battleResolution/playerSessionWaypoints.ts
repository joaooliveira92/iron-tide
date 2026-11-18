import {
  UM_PER_METRE,
  WAYPOINT_ARRIVAL_TOLERANCE_METRES,
  WAYPOINT_REACHED_EVENT_TYPE,
} from "../orders/constants.js";
import type { TacticalDivision } from "../tactical/division.js";
import { validatedWaypoint } from "./playerSessionOrders.js";
import type {
  PlayerBattleEvent,
  PlayerBattleOrders,
  PlayerBattleSession,
  PlayerBattleWaypointArrival,
} from "./playerSessionTypes.js";

function leadingShipId(session: PlayerBattleSession, division: TacticalDivision): string | null {
  const candidates = [division.tacticalFlagshipId, ...division.orderedTacticalUnitIds];
  for (const shipId of candidates) {
    const terminal = session.damage.targets[shipId]?.state.terminalStatus ?? "NORMAL";
    if (terminal === "NORMAL" && session.state.movementStates?.[shipId] !== undefined) {
      return shipId;
    }
  }
  return null;
}

function withinToleranceMetres(
  position: readonly [number, number],
  xMetres: number,
  yMetres: number,
  toleranceMetres: number,
): boolean {
  const dx = Math.trunc(position[0] / UM_PER_METRE) - xMetres;
  const dy = Math.trunc(position[1] / UM_PER_METRE) - yMetres;
  return dx * dx + dy * dy <= toleranceMetres * toleranceMetres;
}

export function settleWaypointArrivals(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
): PlayerBattleSession {
  const previous = session.waypointArrivals ?? {};
  const toleranceMetres =
    session.waypointRules?.arrivalToleranceMetres ?? WAYPOINT_ARRIVAL_TOLERANCE_METRES;
  const next: Record<string, PlayerBattleWaypointArrival> = {};
  const events: PlayerBattleEvent[] = [];
  for (const division of session.state.divisions) {
    const divisionId = division.tacticalDivisionId;
    const order = orders.divisions[divisionId];
    const waypoint = order === undefined ? null : validatedWaypoint(order);
    if (waypoint === null) continue;
    const held = previous[divisionId];
    if (
      held !== undefined &&
      held.xMetres === waypoint.xMetres &&
      held.yMetres === waypoint.yMetres
    ) {
      next[divisionId] = held;
      continue;
    }
    const shipId = leadingShipId(session, division);
    const movement = shipId === null ? undefined : session.state.movementStates?.[shipId];
    if (shipId === null || movement === undefined) continue;
    if (
      !withinToleranceMetres(movement.position, waypoint.xMetres, waypoint.yMetres, toleranceMetres)
    ) {
      continue;
    }
    next[divisionId] = { ...waypoint, headingDeg: movement.heading, minute: session.minute };
    events.push({
      minute: session.minute,
      eventType: WAYPOINT_REACHED_EVENT_TYPE,
      actorId: shipId,
      targetId: divisionId,
    });
  }
  const unchanged =
    events.length === 0 &&
    Object.keys(next).length === Object.keys(previous).length &&
    Object.keys(next).every((key) => next[key] === previous[key]);
  if (unchanged) return session;
  return { ...session, waypointArrivals: next, log: [...session.log, ...events] };
}
