import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { DamageContext } from "./damage.js";
import {
  engagementHeading,
  headingToward,
  rangeBetweenUm,
  resolveRangeController,
} from "./engagement.js";

export function pursuitOrders(input: {
  battleId: string;
  battleState: TacticalBattleState;
  damage: DamageContext;
  units: readonly TacticalShipUnit[];
  baseOrders: Readonly<Record<string, { orderedHeading: number; orderedSpeedBp: number }>>;
}): Record<string, { orderedHeading: number; orderedSpeedBp: number }> {
  const { battleId, battleState, damage, units, baseOrders } = input;
  const movement = battleState.movementStates ?? {};
  const contactPos = new Map(
    (battleState.contacts ?? []).map((c) => [c.contactId, c.position] as const),
  );
  const viable = (id: string): boolean =>
    (damage.targets[id]?.state.terminalStatus ?? "NORMAL") === "NORMAL";
  const rangeController = resolveRangeController(units).controller;
  const out: Record<string, { orderedHeading: number; orderedSpeedBp: number }> = {};
  for (const u of units) {
    const base = baseOrders[u.assetId];
    const own = movement[u.assetId];
    if (!base || !own) continue;
    let best: {
      dx: number;
      dy: number;
      d2: number;
      id: string;
      pos: readonly [number, number];
    } | null = null;
    for (const e of units) {
      if (e.sideId === u.sideId || !viable(e.assetId)) continue;
      const pos = contactPos.get(`${battleId}:${e.assetId}`);
      if (!pos) continue;
      const dx = pos[0] - own.position[0];
      const dy = pos[1] - own.position[1];
      const d2 = dx * dx + dy * dy;
      if (!best || d2 < best.d2 || (d2 === best.d2 && e.assetId < best.id)) {
        best = { dx, dy, d2, id: e.assetId, pos };
      }
    }
    const isController = rangeController !== null && u.sideId === rangeController;
    out[u.assetId] = {
      orderedHeading: !best
        ? own.heading
        : isController
          ? engagementHeading({
              rangeUm: rangeBetweenUm(own.position, best.pos),
              bearingToEnemy: headingToward(best.dx, best.dy),
            })
          : headingToward(best.dx, best.dy),
      orderedSpeedBp: base.orderedSpeedBp,
    };
  }
  return out;
}
