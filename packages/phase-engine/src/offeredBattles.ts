import type { CampaignSnapshot } from "@bluewave/campaign";
import type { BattleGenerationResult } from "@bluewave/combat";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomEngine } from "@bluewave/random";
import { resolveShipStrength } from "./battles.js";
import { OFFERED_MISSION_TYPES } from "./battleOffer.js";
import type { MonthContext } from "./monthContext.js";

export type GeneratedManifest = BattleGenerationResult["manifests"][number];

export function enemyOf(manifest: GeneratedManifest, playerNationId: string): string | null {
  if (!OFFERED_MISSION_TYPES.some((mission) => mission === manifest["missionType"])) return null;
  if (manifest["attackerId"] === playerNationId) return manifest["defenderId"];
  if (manifest["defenderId"] === playerNationId) return manifest["attackerId"];
  return null;
}

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
