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
  compileDivisionOrders,
  divisionOrdersFromLegacy,
  type DivisionNavigation,
  type DivisionOrderSet,
  type DivisionSpeed,
} from "../orders/index.js";
import type {
  PlayerBattleOrders,
  PlayerBattleSession,
  PlayerBattleStance,
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

function divisionOrderSet(
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
      const navigation: DivisionNavigation =
        requested.courseDeg === undefined
          ? entry.navigation
          : {
              kind: "COURSE",
              headingDeg: requireInteger(
                "courseDeg",
                requested.courseDeg,
                0,
                DIVISION_ORDER_MAX_HEADING_DEG,
              ),
            };
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
): Record<string, UnitOrders> {
  const pursuit = pursuitOrders({
    battleId: session.battleId,
    battleState: session.state,
    damage: session.damage,
    units: session.units,
    baseOrders: session.baseOrders,
  });
  return compileDivisionOrders({
    orders: divisionOrderSet(orders, session.state.divisions),
    units: session.units,
    divisions: session.state.divisions,
    baseOrders: session.baseOrders,
    movement: session.state.movementStates ?? {},
    pursuit,
    headingAway: (unit) => headingAway(session, unit),
  }).unitOrders;
}
