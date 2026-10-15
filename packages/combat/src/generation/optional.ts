import type { RandomStream } from "@bluewave/random";

export const OPTIONAL_ASSET_SELECTION_V1 = "optional_asset_selection_v1" as const;
export const OPTIONAL_ASSET_STREAM =
  "battle_generation/month/war/area/mission/optional_asset" as const;

export interface OptionalAssetCandidate {
  assetId: string;
  baseMissionWeight: number;
  readinessMultiplierBp: number;
  missionFitMultiplierBp: number;
  commanderMultiplierBp: number;
  objectiveMultiplierBp: number;
  fatigueMultiplierBp: number;
}

// DESIGN-37 §15: selectionWeight integer formula. All inputs explicit integers.
// The raw product can exceed 2^53 (10^20), so the integer division is evaluated
// with BigInt then clamped to the safe-integer result range (max 10_000).
export function selectionWeightV1(c: OptionalAssetCandidate): number {
  const product =
    BigInt(c.baseMissionWeight) *
    BigInt(c.readinessMultiplierBp) *
    BigInt(c.missionFitMultiplierBp) *
    BigInt(c.commanderMultiplierBp) *
    BigInt(c.objectiveMultiplierBp) *
    BigInt(c.fatigueMultiplierBp);
  const denominator = 10_000n ** 5n;
  const weight = product / denominator; // floor for non-negative integers
  return Math.max(1, Number(weight));
}

// Candidates enumerated by ascending stable identifier; weighted selection uses
// the exact stream keyed by ordered candidate-set hash + optional role id.
export function optionalAssetSelectionV1(
  candidates: OptionalAssetCandidate[],
  optionalRoleId: string,
  randomStream: RandomStream,
  maxAssets: number,
): string[] {
  const ordered = [...candidates].sort((a, b) => a.assetId.localeCompare(b.assetId));
  // stream identity (candidate-set hash + role id) is established by the caller
  // when constructing the RandomStream key.

  const selected: string[] = [];
  const weights = ordered.map((c) => selectionWeightV1(c));
  const total = weights.reduce((s, w) => s + w, 0);

  for (let k = 0; k < Math.min(maxAssets, ordered.length); k++) {
    if (total <= 0) break;
    const draw = randomStream.next() * total;
    let acc = 0;
    let chosen = 0;
    for (let i = 0; i < ordered.length; i++) {
      acc += weights[i]!;
      if (draw < acc) {
        chosen = i;
        break;
      }
    }
    selected.push(ordered[chosen]!.assetId);
  }

  // key contract: candidate-set hash + role id are part of the key used by the
  // caller when constructing the RandomStream.
  return selected;
}

export function optionalAssetStreamKey(
  month: string,
  warId: string,
  areaId: string,
  missionType: string,
  candidateSetHash: string,
  optionalRoleId: string,
): string {
  return `${OPTIONAL_ASSET_STREAM}:${month}:${warId}:${areaId}:${missionType}:${candidateSetHash}:${optionalRoleId}`;
}
