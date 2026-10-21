// T-1 07 (spec #109 R11, ticket #116): the enemy declines a battle with the player. It runs in battle_generation, right
// after generation has produced its manifests: for each generated battle in which the player is a party and whose
// mission is an offered one, a ruleset predicate on the force balance decides whether a draw is made at all, and a
// recorded, domain-separated draw decides the decline. A declined battle is removed before it exists: no instance, no
// manifest, no reservation, no offer. The player is told through one event that carries neither the draw nor the enemy
// force. Dormant without the battle-offer section and the player nation; nothing here reads the interruption channel, so
// the decision cannot depend on how or when the player answers an offer.
import type { CampaignSnapshot } from "@bluewave/campaign";
import {
  BATTLE_ENEMY_DECLINED,
  BATTLE_ENEMY_PROCEEDS,
  ENEMY_DECLINE_DRAW_RANGE_BP,
  enemyDeclineDrawDeclines,
  enemyDeclinePredicateHolds,
  type BattleGenerationResult,
} from "@bluewave/combat";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { applyWarScoreDelta, resolveShipStrength } from "./battles.js";
import { OFFERED_MISSION_TYPES } from "./battleOffer.js";
import { enemyDeclinedBattleEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

/** The stream of the decline draw; the entity key is the prospective battle, which carries the war, area, mission and month. */
export const ENEMY_DECLINE_STREAM = "battle-offer/enemy-decline";

function committedStrength(
  snapshot: CampaignSnapshot,
  nationId: string,
  committed: ReadonlySet<string>,
): number {
  const nation = snapshot["nations"].get(nationId);
  if (nation === undefined) return 0;
  let total = 0n;
  for (const fleet of nation["fleets"]) {
    for (const ship of fleet["ships"]) {
      if (committed.has(ship["id"])) total += BigInt(resolveShipStrength(snapshot, ship["id"]));
    }
  }
  return Number(total);
}

type GeneratedManifest = BattleGenerationResult["manifests"][number];

/** Whether the player is a party to this offered-mission manifest, and who the enemy is. */
function enemyOf(manifest: GeneratedManifest, playerNationId: string): string | null {
  if (!OFFERED_MISSION_TYPES.some((mission) => mission === manifest["missionType"])) return null;
  if (manifest["attackerId"] === playerNationId) return manifest["defenderId"];
  if (manifest["defenderId"] === playerNationId) return manifest["attackerId"];
  return null;
}

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
  if (rules === undefined || playerNationId === undefined) return generated;
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
    const draw = Math.floor(
      engine.stream(`${ENEMY_DECLINE_STREAM}/${battleId}`).next() * ENEMY_DECLINE_DRAW_RANGE_BP,
    );
    const declines = enemyDeclineDrawDeclines(draw, rule.probabilityBp);
    ctx.randomLedger.record({
      streamId: ENEMY_DECLINE_STREAM,
      entityKey: battleId,
      phase: "battle_generation",
      rulesetVersion: snapshot["rulesetVersion"],
      inputHash: sha256Hex(
        canonicalSerialize({
          battleId,
          manifestHash: manifest["manifestHash"],
          sectionVersion: rules.sectionVersion,
          comparison: rule.comparison,
          thresholdBp: rule.thresholdBp,
          probabilityBp: rule.probabilityBp,
        }),
      ),
      draw,
      outcome: declines ? "DECLINED" : "PROCEEDS",
      reasonCode: declines ? BATTLE_ENEMY_DECLINED : BATTLE_ENEMY_PROCEEDS,
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
