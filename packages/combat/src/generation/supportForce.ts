import { sha256Hex } from "@bluewave/deterministic";
import {
  ALLIED_MAX_STRENGTH_BP,
  ALLIED_MAX_STRENGTH_DIVISOR,
  orderAlliedCandidates,
  type AlliedCandidate,
} from "./allied.js";
import { buildManifest, type BattleManifest } from "./manifest.js";
import { deriveBattleSeed } from "./seed.js";

export const SUPPORT_FORCE_DRAW_RANGE_BP = 10_000;

export const BATTLE_SUPPORT_FORCE_PRESENT = "BATTLE_SUPPORT_FORCE_PRESENT";
export const BATTLE_SUPPORT_FORCE_ABSENT = "BATTLE_SUPPORT_FORCE_ABSENT";

export function supportForceStrengthCap(homeStrength: number, shareOfCapBp: number): number {
  if (homeStrength <= 0 || shareOfCapBp <= 0) return 0;
  const share = Math.min(shareOfCapBp, ALLIED_MAX_STRENGTH_BP);
  return Number((BigInt(homeStrength) * BigInt(share)) / BigInt(ALLIED_MAX_STRENGTH_DIVISOR));
}

export function composeSupportForce(
  candidates: readonly AlliedCandidate[],
  cap: number,
): AlliedCandidate[] {
  const chosen: AlliedCandidate[] = [];
  let total = 0n;
  for (const candidate of orderAlliedCandidates([...candidates])) {
    const next = total + BigInt(candidate.effectiveStrength);
    if (candidate.effectiveStrength <= 0 || next > BigInt(cap)) continue;
    chosen.push(candidate);
    total = next;
  }
  return chosen;
}

export function supportForceDrawPresent(draw: number, presenceChanceBp: number): boolean {
  return draw < presenceChanceBp;
}

export interface SupportForceSeedInputs {
  rngVersion: string;
  campaignSeed: string;
  campaignMonth: string;
  battleGenerationFormulaVersion: string;
}

export function withSupportForce(
  manifest: BattleManifest,
  playerNationId: string,
  supportAssetIds: readonly string[],
  supportNationIds: readonly string[],
  seed: SupportForceSeedInputs,
): BattleManifest {
  const playerSide = manifest.attackerId === playerNationId ? "ATTACKER" : "DEFENDER";
  const { battleSeed: _seed, manifestHash: _hash, ...base } = manifest;
  const rebuilt = buildManifest({
    ...base,
    temporaryAssets: [...manifest.temporaryAssets, ...supportAssetIds],
    sides: manifest.sides.map((side) =>
      side.sideId === playerSide
        ? { ...side, participantIds: [...side.participantIds, ...supportNationIds] }
        : side,
    ),
  });
  const battleSeed = deriveBattleSeed(
    {
      rngVersion: seed.rngVersion,
      campaignSeed: seed.campaignSeed,
      campaignMonth: seed.campaignMonth,
      warId: rebuilt.warId,
      areaId: rebuilt.areaId,
      missionType: rebuilt.missionType,
      opportunityId: rebuilt.opportunityId,
      battleGenerationFormulaVersion: seed.battleGenerationFormulaVersion,
    },
    rebuilt,
  );
  return { ...rebuilt, battleSeed };
}

export function supportCandidateDigest(candidates: readonly AlliedCandidate[]): string {
  return sha256Hex(candidates.map((c) => `${c.nationId}\u0000${c.assetId}`).join("\u0001"));
}
