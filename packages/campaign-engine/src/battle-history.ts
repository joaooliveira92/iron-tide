import type { CampaignSnapshot } from "@bluewave/campaign";

/**
 * The player's battle history, derived from the resolved battles recorded on the
 * snapshot (`wars.battles[]`). Read-only and deterministic.
 *
 * Since ADR-0061 each resolved battle also records the name, class, owner, month and
 * observational cause of every ship lost (`BattleResult.lostShips`). Battles resolved
 * by earlier builds only have ids, so `lostShips` can be empty while `lostShipIds` is not.
 *
 * Flat plain objects only — it crosses the Electron IPC boundary as JSON.
 */

export type BattleOutcomeForPlayer = "won" | "lost" | "undecided" | "not-involved";

/** One ship lost in a battle, as recorded when it was lost (ADR-0061). */
export interface LostShipView {
  readonly name: string;
  readonly classId: string;
  readonly nationName: string;
  readonly ownedByPlayer: boolean;
  /** Campaign month the battle resolved in, as stored (e.g. "1880-03"). */
  readonly month: string;
  /** "gunfire" | "fire" | "flooding" | "torpedo" when the tactical report named one. */
  readonly cause: string | null;
}

export interface BattleHistoryEntry {
  /** 1-based position in the order battles resolved (battles only ever append). */
  readonly sequence: number;
  readonly battleId: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly attackerId: string;
  readonly attackerName: string;
  readonly defenderId: string;
  readonly defenderName: string;
  readonly involvesPlayer: boolean;
  readonly outcomeForPlayer: BattleOutcomeForPlayer;
  /** Ships the player lost (0 for battles the player was not in). */
  readonly playerLossCount: number;
  /** Ships the opposing side(s) lost; for third-party battles, the total of both sides. */
  readonly enemyLossCount: number;
  /** Ids of every ship sunk in the battle, attacker's first (ids only — see header). */
  readonly lostShipIds: readonly string[];
  /**
   * Names and causes of the ships lost. Empty for battles resolved before ADR-0061
   * (saves from earlier builds) even when ships were lost — `lostShipIds` still counts them.
   */
  readonly lostShips: readonly LostShipView[];
}

export interface BattleHistoryView {
  readonly battles: readonly BattleHistoryEntry[];
}

export function buildBattleHistory(
  snapshot: CampaignSnapshot,
  playerNationId: string,
): BattleHistoryView {
  const nationName = (id: string): string => snapshot.nations.get(id)?.name ?? id;
  const areaName = (id: string): string =>
    snapshot.world.areas.find((area) => area.id === id)?.name ?? id;

  const battles: BattleHistoryEntry[] = [];
  for (const battle of snapshot.wars.battles) {
    const result = battle.result;
    if (battle.phase !== "resolved" || result === undefined) continue;

    const playerAttacks = battle.attackerId === playerNationId;
    const playerDefends = battle.defenderId === playerNationId;
    const involvesPlayer = playerAttacks || playerDefends;

    let outcomeForPlayer: BattleOutcomeForPlayer = "not-involved";
    if (involvesPlayer) {
      if (result.winnerId === null || result.loserId === null) outcomeForPlayer = "undecided";
      else outcomeForPlayer = result.winnerId === playerNationId ? "won" : "lost";
    }

    const attackerLosses = result.attackerLosses.length;
    const defenderLosses = result.defenderLosses.length;
    const playerLossCount = playerAttacks ? attackerLosses : playerDefends ? defenderLosses : 0;
    const enemyLossCount = playerAttacks
      ? defenderLosses
      : playerDefends
        ? attackerLosses
        : attackerLosses + defenderLosses;

    battles.push({
      sequence: battles.length + 1,
      battleId: battle.id,
      areaId: battle.areaId,
      areaName: areaName(battle.areaId),
      attackerId: battle.attackerId,
      attackerName: nationName(battle.attackerId),
      defenderId: battle.defenderId,
      defenderName: nationName(battle.defenderId),
      involvesPlayer,
      outcomeForPlayer,
      playerLossCount,
      enemyLossCount,
      lostShipIds: [...result.attackerLosses, ...result.defenderLosses],
      lostShips: (result.lostShips ?? []).map((ship) => ({
        name: ship.name,
        classId: ship.classId,
        nationName: nationName(ship.nationId),
        ownedByPlayer: ship.nationId === playerNationId,
        month: ship.month,
        cause: ship.cause ?? null,
      })),
    });
  }
  return { battles };
}
