import { sha256Hex } from "@bluewave/deterministic";
import { splitSeed } from "@bluewave/random";
import type { BattleManifest } from "./manifest.js";
import { computeManifestHash } from "./manifest.js";

export const BATTLE_SEED_FAMILY = "battle/battle_id/root" as const;
export const BATTLE_SEED_FORMULA_VERSION = "battle_seed_v1" as const;

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

// DESIGN-37 §32: the canonical battle-seed key components. The manifest hash is
// derived from the canonicalized PRE-SEED manifest (ADR B-1-5).
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

  // Campaign-level root seed family; deterministic on every platform.
  const root = splitSeed(inputs.campaignSeed, BATTLE_SEED_FAMILY);
  return sha256Hex(`${domain}\u0000${root}`);
}

export function assertIdenticalManifestIdenticalSeed(
  a: BattleManifest,
  b: BattleManifest,
): boolean {
  return computeManifestHash(a) === computeManifestHash(b);
}
