import { sha256Hex } from "@bluewave/deterministic";
import { splitSeed } from "@bluewave/random";
import type { BattleManifest } from "./manifest.js";
import { computeManifestHash } from "./manifest.js";

export const BATTLE_SEED_FAMILY = "battle/battle_id/root" as const;
export const BATTLE_SEED_FORMULA_VERSION = "battle_seed_v1" as const;
export const GENERATION_SEED_FORMULA_VERSION = "1" as const;

export interface BattleSeedInputs {
  rngVersion: string;
  campaignSeed: string;
  campaignMonth: string;
  warId: string;
  areaId: string;
  missionType: string;
  opportunityId: string;
  battleGenerationFormulaVersion: string;
}

export function deriveBattleSeed(inputs: BattleSeedInputs, manifest: BattleManifest): string {
  const canonicalHash = computeManifestHash(manifest);
  const domain = [
    inputs.rngVersion,
    inputs.campaignSeed,
    BATTLE_SEED_FAMILY,
    inputs.campaignMonth,
    inputs.warId,
    inputs.areaId,
    inputs.missionType,
    inputs.opportunityId,
    canonicalHash,
    inputs.battleGenerationFormulaVersion,
  ].join("\u0000");

  const root = splitSeed(inputs.campaignSeed, BATTLE_SEED_FAMILY);
  return sha256Hex(`${domain}\u0000${root}`);
}

export function assertIdenticalManifestIdenticalSeed(
  a: BattleManifest,
  b: BattleManifest,
): boolean {
  return computeManifestHash(a) === computeManifestHash(b);
}
