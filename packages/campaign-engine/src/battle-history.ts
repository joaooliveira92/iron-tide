import type { CampaignSnapshot } from "@bluewave/campaign";

export type BattleOutcomeForPlayer = "won" | "lost" | "undecided" | "not-involved";

export interface LostShipView {
  readonly name: string;
  readonly classId: string;
  readonly nationName: string;
  readonly ownedByPlayer: boolean;
  readonly month: string;
  readonly cause: string | null;
}

export interface BattleHistoryEntry {
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
  readonly playerLossCount: number;
  readonly enemyLossCount: number;
  readonly lostShipIds: readonly string[];
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
