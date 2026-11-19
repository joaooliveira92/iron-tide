import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { battleLoss } from "../damage/minuteDamage.js";
import type { BattleSide } from "./viability.js";
import type { PlayerBattleResult, PlayerBattleSession } from "./playerSessionTypes.js";

export function resultOf(session: PlayerBattleSession): PlayerBattleResult {
  const sunk = (side: BattleSide): string[] =>
    session.units
      .filter((unit) => unit.sideId === side)
      .filter(
        (unit) =>
          (session.damage.targets[unit.assetId]?.state.terminalStatus ?? "NORMAL") !== "NORMAL",
      )
      .map((unit) => unit.assetId)
      .sort();
  const damageReport: Record<string, number> = {};
  for (const unit of session.units) {
    const state = session.damage.targets[unit.assetId]?.state;
    if (!state) continue;
    damageReport[unit.assetId] = battleLoss(
      unit.hitPoints as number,
      state,
      unit.maxHitPoints as number,
    );
  }
  return {
    winnerId: session.winnerId,
    loserId: session.loserId,
    attackerLosses: sunk("ATTACKER"),
    defenderLosses: sunk("DEFENDER"),
    damageReport,
  };
}

export function playerBattleResult(session: PlayerBattleSession): PlayerBattleResult {
  if (session.result !== null) return session.result;
  return resultOf(session);
}

export function playerBattleSessionHash(session: PlayerBattleSession): string {
  return sha256Hex(
    canonicalSerialize({
      battleId: session.battleId,
      minute: session.minute,
      ended: session.ended,
      endReason: session.endReason,
      winnerId: session.winnerId,
      loserId: session.loserId,
      state: session.state,
      batteries: session.batteries,
      damageTargets: session.damage.targets,
      weather: session.weather.components,
      torpedoes: session.torpedoes ?? null,
      missiles: session.missiles ?? null,
      smoke: session.smoke,
      airCombat: session.airCombat,
      airDefense: session.airDefense,
      log: session.log,
      ...(session.force === undefined ? {} : { force: session.force.runtime }),
      ...(session.collision?.state === undefined
        ? {}
        : { collisionState: session.collision.state }),
      ...(session.waypointArrivals === undefined
        ? {}
        : { waypointArrivals: session.waypointArrivals }),
    }),
  );
}
