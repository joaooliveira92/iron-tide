// T-1 07 (spec #109 R11, ticket #116): the enemy declines a battle with the player. It runs in battle_generation, right
// after generation has produced its manifests: for each generated battle in which the player is a party and whose
// mission is an offered one, a ruleset predicate on the force balance decides whether a draw is made at all, and a
// recorded, domain-separated draw decides the decline. A declined battle is removed before it exists: no instance, no
// manifest, no reservation, no offer. The player is told through one event that carries neither the draw nor the enemy
// force. Dormant without the battle-offer section, the player nation and an interruption channel (R3); the channel is
// only tested for presence, so the decision cannot depend on how or when the player answers an offer.
import {
  BATTLE_ENEMY_DECLINED,
  BATTLE_ENEMY_PROCEEDS,
  ENEMY_DECLINE_DRAW_RANGE_BP,
  enemyDeclineDrawDeclines,
  enemyDeclinePredicateHolds,
  type BattleGenerationResult,
} from "@bluewave/combat";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { applyWarScoreDelta } from "./battles.js";
import { enemyDeclinedBattleEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";
import { committedStrength, drawAndRecord, enemyOf } from "./offeredBattles.js";

/** The stream of the decline draw; the entity key is the prospective battle, which carries the war, area, mission and month. */
export const ENEMY_DECLINE_STREAM = "battle-offer/enemy-decline";

/**
 * Apply the enemy-decline rule to a month's generated battles and return the battles that remain. Returns the input
 * unchanged (the same object) when the rule is dormant or no battle is declined. A draw is made, and recorded, only for a
 * battle whose force balance satisfies the ruleset predicate; an unavoidable mission cannot be declined by either side.
 */
export function applyEnemyDeclines(
  ctx: MonthContext,
  generated: BattleGenerationResult,
): BattleGenerationResult {
  const rules: BattleOfferRules | undefined = ctx.battleOffers;
  const playerNationId = ctx.playerNationId;
  // Dormant without the interruption channel exactly as the offer path is (spec #109 R3): no draw, no change.
  if (rules === undefined || playerNationId === undefined || ctx.interruption === undefined)
    return generated;
  const engine = ctx.phaseGuard.rng("battle_generation", ctx.randomSeed);
  if (engine === null) return generated;

  const rule = rules.enemyDecline;
  const keptIndexes: number[] = [];
  let declined = false;
  generated.manifests.forEach((manifest, index) => {
    const enemyNationId = enemyOf(manifest, playerNationId);
    if (enemyNationId === null || manifest["acceptanceClass"] === "OPERATIONALLY_UNAVOIDABLE") {
      keptIndexes.push(index);
      return;
    }
    const committed = new Set(manifest["persistentAssets"]);
    const snapshot = ctx.currentSnapshot;
    const holds = enemyDeclinePredicateHolds(
      rule.comparison,
      rule.thresholdBp,
      committedStrength(snapshot, enemyNationId, committed),
      committedStrength(snapshot, playerNationId, committed),
    );
    if (!holds) {
      keptIndexes.push(index);
      return;
    }

    const battleId = manifest["battleId"];
    const { declines } = drawAndRecord(ctx, engine, {
      streamId: ENEMY_DECLINE_STREAM,
      battleId,
      rangeBp: ENEMY_DECLINE_DRAW_RANGE_BP,
      inputs: {
        battleId,
        manifestHash: manifest["manifestHash"],
        sectionVersion: rules.sectionVersion,
        comparison: rule.comparison,
        thresholdBp: rule.thresholdBp,
        probabilityBp: rule.probabilityBp,
      },
      classify: (draw) => {
        const declined = enemyDeclineDrawDeclines(draw, rule.probabilityBp);
        return {
          declines: declined,
          outcome: declined ? "DECLINED" : "PROCEEDS",
          reasonCode: declined ? BATTLE_ENEMY_DECLINED : BATTLE_ENEMY_PROCEEDS,
        };
      },
    });
    if (!declines) {
      keptIndexes.push(index);
      return;
    }

    declined = true;
    const cost = rule.enemyCostPoints ?? 0;
    const war = snapshot["wars"]["wars"].find((w) => w["id"] === manifest["warId"]);
    if (cost > 0 && war !== undefined) {
      const enemyIsAttacker = war["attackerSideMembers"].includes(enemyNationId);
      ctx.currentSnapshot = applyWarScoreDelta(
        snapshot,
        war["id"],
        enemyIsAttacker ? { attacker: -cost, defender: 0 } : { attacker: 0, defender: -cost },
        ctx.campaignMonth,
      );
    }
    ctx.eventLedger.append(
      enemyDeclinedBattleEvent(
        playerNationId,
        enemyNationId,
        battleId,
        manifest["missionType"],
        manifest["areaId"],
        cost,
        ctx.nextSeq(),
        ctx.campaignMonth,
      ),
    );
  });
  if (!declined) return generated;

  const keptIds = new Set(keptIndexes.map((i) => generated.battleIds[i]!));
  return {
    ...generated,
    manifests: keptIndexes.map((i) => generated.manifests[i]!),
    battleIds: keptIndexes.map((i) => generated.battleIds[i]!),
    records: generated.records.filter((record) => record.accepted.every((id) => keptIds.has(id))),
  };
}
