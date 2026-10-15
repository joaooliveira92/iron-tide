import type { BattleInstance, CampaignSnapshot } from "@bluewave/campaign";
import {
  VICTORY_MAJOR_MAX_FRACTION,
  VICTORY_MINOR_MAX_FRACTION,
  WAR_SCORE_DECISIVE,
  WAR_SCORE_MAJOR,
  WAR_SCORE_MINOR,
} from "@bluewave/campaign";
import type { BattleOutcome } from "@bluewave/campaign-engine";

/**
 * Hydrate the month's `BattleOutcome` list (INC-2) strictly from the engine's
 * authoritative snapshots — nothing fabricated. One flat, vanilla-safe
 * `BattleOutcome` per battle that became `phase === "resolved"` (with a
 * `BattleResult`) THIS month, i.e. present on the post-month snapshot but not
 * yet resolved on the pre-month snapshot.
 *
 * The INC-2 ticket proposed collecting the ids from `BattleResolved` domain
 * events, but verified against the actual engine the `month.ts`
 * battle-resolution phase never emits `BattleResolved` (or `BattleInitiated`)
 * domain events. `wars.battles` accumulates across months, so "resolved this
 * month" is the pre→post resolved-set delta — a pure, deterministic,
 * read-only derivation that keeps the read-only-over-engine boundary and
 * yields byte-identical behavior for months that resolve no battle (`[]`).
 */
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

/**
 * Map one resolved `BattleInstance` to the flat web `BattleOutcome`.
 *
 * `warScoreDelta` re-derives the engine's victory class from the losing side's
 * loss-fraction, but on the **PRE-month snapshot** (`preSnapshot`), NOT the
 * post-battle snapshot. `applyBattleResult` computes the fraction over the
 * snapshot it is called with — the month's state BEFORE
 * `applyBattleConsequences` reduces survivors' HP and REMOVES sunk ships.
 * Counting the loser's ships on the post-month snapshot would therefore see
 * post-damage HP and lose ships sunk this month, re-deriving a wrong
 * (typically smaller) class than the engine actually applied. The pre-month
 * snapshot restores exactly the HP/ship-set the engine used.
 *
 * Residual inexactness (documented, accepted): in a month that resolves
 * MULTIPLE battles against the same opponent, the engine computes battle B's
 * class off battle A's already-applied damage; deriving every battle off the
 * single pre-month snapshot cannot reproduce that per-battle cascade. For the
 * common single-battle month this matches the engine iff the loser's engaged
 * fleet ship-set/HP are unchanged between the pre-month snapshot and
 * `applyBattleResult` — a ship commissioned into that fleet same-month appears
 * in the engine's basis but not here, so the bridge's lossFraction can be
 * overstated. Both residuals (cascade + commissioning) are recorded in
 * ADR-0028 §Consequences and cross-referenced in INC-5; we deliberately do NOT
 * reconstruct either here (keeps the bridge read-only and simple).
 *
 * Fallback (INC-2): if the losing nation or its fleet ships are genuinely
 * unavailable on the pre-month snapshot (`loserNation === undefined`, or the
 * fleet has no non-under-construction ships / zero total HP), set
 * `warScoreDelta: 0` AND record why — the old
 * `totalHp > 0 ? lossHp / totalHp : 1` fallback would turn absence into a
 * fabricated "decisive +10". Only availability of pre-month ships permits a
 * real re-derivation.
 */
export function mapBattleOutcome(
  battle: BattleInstance,
  preSnapshot: CampaignSnapshot,
  _postSnapshot: CampaignSnapshot, // unused: `battle` already carries the post-month state; the derivation reads PRE
): BattleOutcome {
  const result = battle.result!;
  const explanation = [...result.explanation];
  const loserId = result.loserId;
  // A non-decided battle (winnerId/loserId both null, ADR-0026 §7) contributes
  // NO war score, so its delta is 0 — the bridge never fabricates a winner.
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
  // The losing side's ships at PRE-battle HP, including any sunk this month
  // (they are still counted), mirroring the snapshot `applyBattleResult`
  // computed over.
  const loserNation = preSnapshot.nations.get(loserId);
  const loserShips = loserNation
    ? loserNation.fleets
        .filter((f) => loserFleetIds.includes(f.id))
        .flatMap((f) => f.ships)
        .filter((s) => !s.isUnderConstruction)
    : [];
  const totalHp = loserShips.reduce((sum, s) => sum + Number(s.hitPoints), 0);
  const lossHp = loserShips.reduce((sum, s) => sum + Number(result.damageReport[s.id] ?? 0), 0);
  // INC-2 fallback: a genuinely unavailable loser nation / no fleet ships
  // cannot yield a real class — report 0 and why, never a fabricated +10.
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
