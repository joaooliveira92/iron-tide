import type { BattleInstance, CampaignSnapshot } from "@bluewave/campaign";
import {
  VICTORY_MAJOR_MAX_FRACTION,
  VICTORY_MINOR_MAX_FRACTION,
  WAR_SCORE_DECISIVE,
  WAR_SCORE_MAJOR,
  WAR_SCORE_MINOR,
} from "@bluewave/campaign";
import type { BattleOutcome } from "@bluewave/campaign-engine";

export function collectBattleOutcomes(
  preSnapshot: CampaignSnapshot,
  postSnapshot: CampaignSnapshot,
): BattleOutcome[] {
  const resolvedThisMonth = postSnapshot.wars.battles.filter(
    (b) =>
      b.phase === "resolved" &&
      b.result !== undefined &&
      !preSnapshot.wars.battles.some((prev) => prev.id === b.id && prev.phase === "resolved"),
  );

  return resolvedThisMonth.map((battle) => mapBattleOutcome(battle, preSnapshot, postSnapshot));
}

export function mapBattleOutcome(
  battle: BattleInstance,
  preSnapshot: CampaignSnapshot,
  _postSnapshot: CampaignSnapshot,
): BattleOutcome {
  const result = battle.result!;
  const explanation = [...result.explanation];
  const loserId = result.loserId;
  if (result.winnerId === null || loserId === null) {
    return {
      battleId: battle.id,
      areaId: battle.areaId,
      attackerId: battle.attackerId,
      defenderId: battle.defenderId,
      winnerId: result.winnerId,
      loserId: result.loserId,
      warScoreDelta: 0,
      attackerLosses: [...result.attackerLosses],
      defenderLosses: [...result.defenderLosses],
      explanation,
    };
  }

  const loserIsAttacker = loserId === battle.attackerId;
  const loserFleetIds = loserIsAttacker ? battle.attackerFleetIds : battle.defenderFleetIds;
  const loserNation = preSnapshot.nations.get(loserId);
  const loserShips = loserNation
    ? loserNation.fleets
        .filter((f) => loserFleetIds.includes(f.id))
        .flatMap((f) => f.ships)
        .filter((s) => !s.isUnderConstruction)
    : [];
  const totalHp = loserShips.reduce((sum, s) => sum + Number(s.hitPoints), 0);
  const lossHp = loserShips.reduce((sum, s) => sum + Number(result.damageReport[s.id] ?? 0), 0);
  if (loserNation === undefined || loserShips.length === 0 || totalHp <= 0) {
    explanation.push(
      `war-score delta not re-derived: losing nation "${loserId}" or its fleet ships are unavailable on the pre-month snapshot`,
    );
    return {
      battleId: battle.id,
      areaId: battle.areaId,
      attackerId: battle.attackerId,
      defenderId: battle.defenderId,
      winnerId: result.winnerId,
      loserId: result.loserId,
      warScoreDelta: 0,
      attackerLosses: [...result.attackerLosses],
      defenderLosses: [...result.defenderLosses],
      explanation,
    };
  }

  const lossFraction = lossHp / totalHp;
  const level =
    lossFraction >= VICTORY_MAJOR_MAX_FRACTION
      ? "decisive"
      : lossFraction >= VICTORY_MINOR_MAX_FRACTION
        ? "major"
        : "minor";
  const magnitude =
    level === "decisive"
      ? WAR_SCORE_DECISIVE
      : level === "major"
        ? WAR_SCORE_MAJOR
        : WAR_SCORE_MINOR;

  return {
    battleId: battle.id,
    areaId: battle.areaId,
    attackerId: battle.attackerId,
    defenderId: battle.defenderId,
    winnerId: result.winnerId,
    loserId: result.loserId,
    warScoreDelta: magnitude,
    attackerLosses: [...result.attackerLosses],
    defenderLosses: [...result.defenderLosses],
    explanation,
  };
}
