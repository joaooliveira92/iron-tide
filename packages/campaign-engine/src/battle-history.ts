import type { CampaignSnapshot, DeclinedBattleRecord, GateReasonTag } from "@bluewave/campaign";

export type BattleOutcomeForPlayer = "won" | "lost" | "undecided" | "not-involved";

export interface LostShipView {
  readonly name: string;
  readonly classId: string;
  readonly nationName: string;
  readonly ownedByPlayer: boolean;
  readonly month: string;
  readonly cause: string | null;
}

export interface AbsentShipView {
  readonly shipId: string;
  readonly shipName: string;
  readonly reasons: readonly GateReasonTag[];
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
  readonly absentShips?: readonly AbsentShipView[];
}

export type DeclinedBattleHistoryEntry = Pick<
  DeclinedBattleRecord,
  | "battleId"
  | "warId"
  | "nationId"
  | "areaId"
  | "month"
  | "missionType"
  | "victoryPointCost"
  | "opponentCredit"
>;

export interface BattleHistoryView {
  readonly battles: readonly BattleHistoryEntry[];
  readonly declinedBattles?: readonly DeclinedBattleHistoryEntry[];
}

export function buildBattleHistory(
  snapshot: CampaignSnapshot,
  playerNationId: string,
): BattleHistoryView {
  const nationName = (id: string): string => snapshot.nations.get(id)?.name ?? id;
  const areaName = (id: string): string =>
    snapshot.world.areas.find((area) => area.id === id)?.name ?? id;

  const shipNames = new Map<string, string>();
  for (const ship of snapshot.nations.get(playerNationId)?.fleets.flatMap((f) => f.ships) ?? []) {
    shipNames.set(ship.id, ship.name);
  }

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

    const absentShips = involvesPlayer
      ? (battle.absences ?? []).map((absence) => ({
          shipId: absence.shipId,
          shipName: shipNames.get(absence.shipId) ?? absence.shipId,
          reasons: absence.reasons,
        }))
      : [];

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
      ...(absentShips.length === 0 ? {} : { absentShips }),
    });
  }
  const declinedBattles = (snapshot.wars.declinedBattles ?? [])
    .filter((record) => record.nationId === playerNationId)
    .map((record) => ({
      battleId: record.battleId,
      warId: record.warId,
      nationId: record.nationId,
      areaId: record.areaId,
      month: record.month,
      missionType: record.missionType,
      victoryPointCost: record.victoryPointCost,
      opponentCredit: record.opponentCredit,
    }));

  return {
    battles,
    ...(declinedBattles.length === 0 ? {} : { declinedBattles }),
  };
}
