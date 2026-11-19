import { BluewaveError } from "@bluewave/contracts";
import { assertOrderPermitted } from "../orders/index.js";
import { contactHandle } from "./battleViewFog.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import type { PlayerBattleOrders, PlayerBattleSession } from "./playerSessionTypes.js";

export function preferredTargets(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const division of session.state.divisions) {
    const handle = orders.divisions[division.tacticalDivisionId]?.targetHandle;
    if (handle === undefined) continue;
    if (session.force !== undefined) {
      assertOrderPermitted(
        session.force.realismMode,
        "TARGET_ORDERS",
        undefined,
        undefined,
        "DIVISION",
      );
    }
    const enemy = session.units.find(
      (unit) =>
        unit.sideId !== division.sideId && contactHandle(session.battleId, unit.assetId) === handle,
    );
    if (enemy === undefined) {
      throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
        code: BATTLE_AUTO_RESOLUTION_FAILED,
        reason: "targetHandle does not name an enemy contact",
        divisionId: division.tacticalDivisionId,
      });
    }
    const contact = `${session.battleId}:${enemy.assetId}`;
    for (const shipId of division.orderedTacticalUnitIds) out[shipId] = contact;
  }
  return out;
}
