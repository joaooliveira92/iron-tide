// Shared by the two battle_generation stages of the T-1 battle-offer feature (enemy decline, ticket #116, and the friendly
// support force, ticket #117): who the enemy of an offered battle is, the strength a side commits to it, and the one recorded,
// domain-separated draw both stages make. Kept in one place so the two stages cannot drift apart.
import type { CampaignSnapshot } from "@bluewave/campaign";
import type { BattleGenerationResult } from "@bluewave/combat";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomEngine } from "@bluewave/random";
import { resolveShipStrength } from "./battles.js";
import { OFFERED_MISSION_TYPES } from "./battleOffer.js";
import type { MonthContext } from "./monthContext.js";

export type GeneratedManifest = BattleGenerationResult["manifests"][number];

/** Whether the player is a party to this offered-mission manifest, and who the enemy is. */
export function enemyOf(manifest: GeneratedManifest, playerNationId: string): string | null {
  if (!OFFERED_MISSION_TYPES.some((mission) => mission === manifest["missionType"])) return null;
  if (manifest["attackerId"] === playerNationId) return manifest["defenderId"];
  if (manifest["defenderId"] === playerNationId) return manifest["attackerId"];
  return null;
}

/** The summed strength of a nation's committed ships. */
export function committedStrength(
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

/**
 * Make the battle's one draw on `${streamId}/${battleId}` (an integer in `0..rangeBp-1`), let the caller classify it, and
 * record it in the random ledger with the hash of `inputs`. Returns the classification the caller made of the draw.
 */
export function drawAndRecord<Classification extends { outcome: string; reasonCode: string }>(
  ctx: MonthContext,
  engine: RandomEngine,
  step: {
    readonly streamId: string;
    readonly battleId: string;
    readonly rangeBp: number;
    readonly inputs: unknown;
    readonly classify: (draw: number) => Classification;
  },
): Classification {
  const draw = Math.floor(engine.stream(`${step.streamId}/${step.battleId}`).next() * step.rangeBp);
  const classification = step.classify(draw);
  ctx.randomLedger.record({
    streamId: step.streamId,
    entityKey: step.battleId,
    phase: "battle_generation",
    rulesetVersion: ctx.currentSnapshot["rulesetVersion"],
    inputHash: sha256Hex(canonicalSerialize(step.inputs)),
    draw,
    outcome: classification.outcome,
    reasonCode: classification.reasonCode,
  });
  return classification;
}
