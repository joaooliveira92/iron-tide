import { BluewaveError } from "@bluewave/contracts";
import {
  NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP,
  TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP,
  TORPEDO_SOLUTION_FACTOR_KEYS,
  TORPEDO_SOLUTION_FINAL_MAX_BP,
  TORPEDO_SOLUTION_FINAL_MIN_BP,
  TORPEDO_SOLUTION_MINIMUM_BP,
  TORPEDO_SOLUTION_ROUNDING,
  TORPEDO_SOLUTION_SCALE_EXPONENT,
  type TorpedoLaunchKind,
  type TorpedoSolutionFactorKey,
} from "./constants.js";
import { TORPEDO_FIRE_SOLUTION_FACTOR_MISSING } from "./reasonCodes.js";

const SOLUTION_SCALE_N = 10_000n;
export const TORPEDO_SOLUTION_DENOMINATOR: bigint =
  SOLUTION_SCALE_N ** BigInt(TORPEDO_SOLUTION_SCALE_EXPONENT);

export type TorpedoSolutionFactors = {
  baseSolutionBp: number;
} & Record<TorpedoSolutionFactorKey, number>;

export function neutralTorpedoSolutionFactors(baseSolutionBp: number): TorpedoSolutionFactors {
  const multipliers = {} as Record<TorpedoSolutionFactorKey, number>;
  for (const key of TORPEDO_SOLUTION_FACTOR_KEYS) {
    multipliers[key] = NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP;
  }
  return { baseSolutionBp, ...multipliers };
}

export interface TorpedoSolutionRoundingDetail {
  mode: string;
  numerator: string;
  denominator: string;
  rawFlooredBp: number;
}

export interface TorpedoSolutionResolution {
  factorKeys: readonly TorpedoSolutionFactorKey[];
  factors: TorpedoSolutionFactors;
  solutionQualityBp: number;
  rounding: TorpedoSolutionRoundingDetail;
}

export function computeTorpedoSolutionQuality(
  factors: TorpedoSolutionFactors,
): TorpedoSolutionResolution {
  if (!Number.isInteger(factors.baseSolutionBp) || factors.baseSolutionBp < 0) {
    throw new BluewaveError(TORPEDO_FIRE_SOLUTION_FACTOR_MISSING, {
      code: TORPEDO_FIRE_SOLUTION_FACTOR_MISSING,
      factorKey: "baseSolutionBp",
      reason: "base solution quality must be a non-negative integer basis point",
      value: factors.baseSolutionBp,
    });
  }
  let numerator: bigint = BigInt(factors.baseSolutionBp);
  for (const key of TORPEDO_SOLUTION_FACTOR_KEYS) {
    const m: unknown = factors[key];
    if (m === undefined || m === null || !Number.isInteger(m)) {
      throw new BluewaveError(TORPEDO_FIRE_SOLUTION_FACTOR_MISSING, {
        code: TORPEDO_FIRE_SOLUTION_FACTOR_MISSING,
        factorKey: key,
        reason: "missing, undefined, or non-integer solution factor",
        value: m,
      });
    }
    const multiplier = m as number;
    if (multiplier < 0 || multiplier > TORPEDO_SOLUTION_FINAL_MAX_BP) {
      throw new BluewaveError(TORPEDO_FIRE_SOLUTION_FACTOR_MISSING, {
        code: TORPEDO_FIRE_SOLUTION_FACTOR_MISSING,
        factorKey: key,
        reason: `solution factor must be an integer basis point within [0, ${TORPEDO_SOLUTION_FINAL_MAX_BP}]`,
        value: multiplier,
      });
    }
    numerator = numerator * BigInt(multiplier);
  }
  const rawFloored: bigint = numerator / TORPEDO_SOLUTION_DENOMINATOR;
  const rawFlooredBp: number =
    rawFloored > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(rawFloored);
  const solutionQualityBp = Math.min(
    TORPEDO_SOLUTION_FINAL_MAX_BP,
    Math.max(TORPEDO_SOLUTION_FINAL_MIN_BP, rawFlooredBp),
  );
  return {
    factorKeys: TORPEDO_SOLUTION_FACTOR_KEYS,
    factors,
    solutionQualityBp,
    rounding: {
      mode: TORPEDO_SOLUTION_ROUNDING,
      numerator: numerator.toString(),
      denominator: TORPEDO_SOLUTION_DENOMINATOR.toString(),
      rawFlooredBp,
    },
  };
}

export function minimumSolutionQualityBp(
  launchKind: TorpedoLaunchKind,
  friendlyInDangerSector: boolean,
): number {
  if (friendlyInDangerSector) return TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP;
  return TORPEDO_SOLUTION_MINIMUM_BP[launchKind];
}

export function solutionMeetsMinimum(
  solutionQualityBp: number,
  launchKind: TorpedoLaunchKind,
  friendlyInDangerSector: boolean,
): boolean {
  return solutionQualityBp >= minimumSolutionQualityBp(launchKind, friendlyInDangerSector);
}
