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
} from "@bluewave/combat/generation";
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

export const SUPPORT_FORCE_STREAM = "battle-offer/support-force";

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

export function applySupportForces(
  ctx: MonthContext,
  generated: BattleGenerationResult,
): BattleGenerationResult {
  const rules: BattleOfferRules | undefined = ctx.battleOffers;
  const playerNationId = ctx.playerNationId;
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
