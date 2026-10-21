// T-1 08 (spec #109 R12, ticket #117): the friendly AI-controlled support force. Pure and integer-only: the strength cap,
// the composition through the existing candidate ordering, the way a recorded draw becomes a presence decision, and the
// rebuilt manifest that carries the force. The draw itself is made and recorded by the caller (the phase engine), so this
// module owns no randomness and no ledger. Support ships ride on the manifest's `temporaryAssets` and their nations on
// the player's side, so the unchanged auto-resolution neither reserves, promotes nor damages them.
import { sha256Hex } from "@bluewave/deterministic";
import {
  ALLIED_MAX_STRENGTH_BP,
  ALLIED_MAX_STRENGTH_DIVISOR,
  orderAlliedCandidates,
  type AlliedCandidate,
} from "./allied.js";
import { buildManifest, type BattleManifest } from "./manifest.js";
import { deriveBattleSeed } from "./seed.js";

/** A support-presence draw is an integer in `0 .. SUPPORT_FORCE_DRAW_RANGE_BP - 1`, compared against the chance in basis points. */
export const SUPPORT_FORCE_DRAW_RANGE_BP = 10_000;

/** The recorded reason codes of the support-presence draw. */
export const BATTLE_SUPPORT_FORCE_PRESENT = "BATTLE_SUPPORT_FORCE_PRESENT";
export const BATTLE_SUPPORT_FORCE_ABSENT = "BATTLE_SUPPORT_FORCE_ABSENT";

/**
 * The strength the support force may not exceed: `floor(homeStrength * shareBp / 10000)`, with the share clamped to the
 * existing allied cap (`ALLIED_MAX_STRENGTH_BP`, 50%) so no ruleset value can lift it above `maximumAlliedStrength`.
 * Exact in bigint, no float.
 */
export function supportForceStrengthCap(homeStrength: number, shareOfCapBp: number): number {
  if (homeStrength <= 0 || shareOfCapBp <= 0) return 0;
  const share = Math.min(shareOfCapBp, ALLIED_MAX_STRENGTH_BP);
  return Number((BigInt(homeStrength) * BigInt(share)) / BigInt(ALLIED_MAX_STRENGTH_DIVISOR));
}

/**
 * Compose the support force: candidates in the existing allied ordering, each taken when it still fits under the cap and
 * skipped otherwise. The result is in ordering order; an empty result means there is nothing to draw for.
 */
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

/** The support force is present when the recorded draw falls under the ruleset chance (basis points). */
export function supportForceDrawPresent(draw: number, presenceChanceBp: number): boolean {
  return draw < presenceChanceBp;
}

export interface SupportForceSeedInputs {
  rngVersion: string;
  campaignSeed: string;
  campaignMonth: string;
  battleGenerationFormulaVersion: string;
}

/**
 * The manifest of a battle that carries a support force: the support ships on `temporaryAssets`, their nations on the
 * player's side, and the hash and seed re-derived over the new content. `playerNationId` must be a party to the battle.
 */
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

/** A stable digest of the candidate set a draw was made over, for the ledger input hash. */
export function supportCandidateDigest(candidates: readonly AlliedCandidate[]): string {
  return sha256Hex(candidates.map((c) => `${c.nationId}\u0000${c.assetId}`).join("\u0001"));
}
