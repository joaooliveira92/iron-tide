// T-1 08 (spec #109 R12, ticket #117): the friendly AI-controlled support force. It runs in battle_generation, after the
// enemy has had its chance to decline: for each surviving offered-mission battle with the player as a party it gathers the
// allied candidates, composes them through the existing candidate ordering under the ruleset-clamped share of the existing
// cap, and only when that composition is non-empty makes one recorded, domain-separated presence draw. A present force
// rides on the manifest as temporary assets (never reserved, promoted or damaged by the unchanged auto-resolution) with
// its nations on the player's side. Dormant without the battle-offer section, the player nation and an interruption channel (R3); it only tests
// the channel for presence, so the draw cannot depend on how or when the player answers an offer.
//
// Eligibility (ADR-0259): an ally is a nation in an `allied` relation with the player that is neither party to the battle
// nor on the enemy's side of its war (that relation is the operational access and the authorization the repository models);
// its ships must pass the unchanged S-1 gathering (not working up, not in reserve or mothballed, at or above the readiness
// floor, in the battle area, not already in a battle) and must not be a committed asset of, or support in, another battle.
import type { CampaignSnapshot } from "@bluewave/campaign";
import {
  BATTLE_SUPPORT_FORCE_ABSENT,
  BATTLE_SUPPORT_FORCE_PRESENT,
  GENERATION_SEED_FORMULA_VERSION,
  SUPPORT_FORCE_DRAW_RANGE_BP,
  composeSupportForce,
  gatherEligibleAssets,
  supportCandidateDigest,
  supportForceDrawPresent,
  supportForceStrengthCap,
  withSupportForce,
  type AlliedCandidate,
  type BattleGenerationResult,
} from "@bluewave/combat";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import {
  resolveCampaignBattleReadiness,
  resolveGenerationShipType,
  resolveShipStrength,
} from "./battles.js";
import type { MonthContext } from "./monthContext.js";
import {
  committedStrength,
  drawAndRecord,
  enemyOf,
  type GeneratedManifest,
} from "./offeredBattles.js";

/** The stream of the presence draw; the entity key is the battle, which carries the war, area, mission and month. */
export const SUPPORT_FORCE_STREAM = "battle-offer/support-force";

/** The nations allied with the player that may support this battle, in code-point order. */
function supportingNations(
  snapshot: CampaignSnapshot,
  manifest: GeneratedManifest,
  playerNationId: string,
  enemyNationId: string,
): string[] {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === manifest["warId"]);
  const enemySide: readonly string[] =
    war === undefined
      ? [enemyNationId]
      : war["attackerSideMembers"].includes(enemyNationId)
        ? war["attackerSideMembers"]
        : war["defenderSideMembers"];
  const allies = new Set<string>();
  for (const relation of snapshot["politics"]["relations"]) {
    if (relation["relation"] !== "allied") continue;
    if (relation["nationA"] === playerNationId) allies.add(relation["nationB"]);
    else if (relation["nationB"] === playerNationId) allies.add(relation["nationA"]);
  }
  return [...allies]
    .filter(
      (nationId) =>
        nationId !== manifest["attackerId"] &&
        nationId !== manifest["defenderId"] &&
        !enemySide.includes(nationId),
    )
    .sort(compareCodePoints);
}

/**
 * Add a support force to the player's offered battles that draw one and return the generated set. Returns the input
 * unchanged (the same object) when the rule is dormant or no battle gains a force. A draw is made, and recorded, only for
 * a battle with a non-empty composition under the cap, so a month with no candidates draws nothing and changes nothing.
 */
export function applySupportForces(
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

  const rule = rules.supportForce;
  const snapshot = ctx.currentSnapshot;
  const taken = new Set<string>(generated.manifests.flatMap((m) => m["persistentAssets"]));
  const manifests = [...generated.manifests];
  const records = [...generated.records];
  let changed = false;

  generated.manifests.forEach((manifest, index) => {
    const enemyNationId = enemyOf(manifest, playerNationId);
    if (enemyNationId === null) return;
    const candidates: AlliedCandidate[] = [];
    for (const nationId of supportingNations(snapshot, manifest, playerNationId, enemyNationId)) {
      const nation = snapshot["nations"].get(nationId);
      if (nation === undefined) continue;
      const { eligible } = gatherEligibleAssets({
        ships: nation["fleets"]
          .flatMap((fleet) => fleet["ships"])
          .filter((s) => !s["isUnderConstruction"]),
        sideId: manifest["attackerId"] === playerNationId ? "ATTACKER" : "DEFENDER",
        nationId,
        areaId: manifest["areaId"],
        reservedAssetIds: taken,
        resolveStrength: (ship) => resolveShipStrength(snapshot, ship["id"]),
        resolveShipType: resolveGenerationShipType,
        resolveReadiness: (ship) => resolveCampaignBattleReadiness(snapshot, ship["id"]),
      });
      for (const asset of eligible) {
        candidates.push({
          assetId: asset.assetId,
          nationId,
          effectiveStrength: asset.effectiveStrength,
          treatyCommitmentPriority: 0,
          missionFit: 0,
        });
      }
    }
    const cap = supportForceStrengthCap(
      committedStrength(snapshot, playerNationId, new Set(manifest["persistentAssets"])),
      rule.shareOfCapBp,
    );
    const composition = composeSupportForce(candidates, cap);
    if (composition.length === 0) return;

    const battleId = manifest["battleId"];
    const { present } = drawAndRecord(ctx, engine, {
      streamId: SUPPORT_FORCE_STREAM,
      battleId,
      rangeBp: SUPPORT_FORCE_DRAW_RANGE_BP,
      inputs: {
        battleId,
        manifestHash: manifest["manifestHash"],
        sectionVersion: rules.sectionVersion,
        presenceChanceBp: rule.presenceChanceBp,
        shareOfCapBp: rule.shareOfCapBp,
        source: rule.source,
        capStrength: cap,
        candidates: supportCandidateDigest(candidates),
        composition: composition.map((c) => c.assetId),
      },
      classify: (draw) => {
        const isPresent = supportForceDrawPresent(draw, rule.presenceChanceBp);
        return {
          present: isPresent,
          outcome: isPresent ? "PRESENT" : "ABSENT",
          reasonCode: isPresent ? BATTLE_SUPPORT_FORCE_PRESENT : BATTLE_SUPPORT_FORCE_ABSENT,
        };
      },
    });
    if (!present) return;

    const nations = [...new Set(composition.map((c) => c.nationId))].sort(compareCodePoints);
    const assets = composition.map((c) => c.assetId);
    const next = withSupportForce(manifest, playerNationId, assets, nations, {
      rngVersion: manifest["rngVersion"],
      campaignSeed: ctx.randomSeed,
      campaignMonth: ctx.campaignMonth,
      battleGenerationFormulaVersion: GENERATION_SEED_FORMULA_VERSION,
    });
    for (const id of assets) taken.add(id);
    manifests[index] = next;
    const recordIndex = records.findIndex((record) => record.accepted.includes(battleId));
    if (recordIndex !== -1) {
      const record = records[recordIndex]!;
      const updated = {
        ...record,
        alliedSupportDecisions: composition.map((c) => `${c.nationId}:${c.assetId}`),
        manifests: [next["manifestHash"]],
        battleSeeds: [next["battleSeed"]],
        recordHash: "",
      };
      records[recordIndex] = { ...updated, recordHash: sha256Hex(canonicalSerialize(updated)) };
    }
    changed = true;
  });
  return changed ? { ...generated, manifests, records } : generated;
}
