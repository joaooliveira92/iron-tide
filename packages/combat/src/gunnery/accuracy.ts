import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine, drawUniform } from "@bluewave/random";
import {
  GUNNERY_ACCURACY_FACTOR_KEYS,
  GUNNERY_ACCURACY_FINAL_MIN_BP,
  GUNNERY_ACCURACY_FINAL_MAX_BP,
  GUNNERY_ACCURACY_ROUNDING,
  GUNNERY_ACCURACY_SCALE_EXPONENT,
  GUNNERY_ACCURACY_NEUTRAL_FACTORS,
  GUNNERY_RULESET_VERSION,
  type GunneryAccuracyFactorKey,
} from "./constants.js";
import { GUNNERY_ACCURACY_FACTOR_MISSING } from "./reasonCodes.js";

const ACCURACY_SCALE_N = 10_000n;
export const GUNNERY_ACCURACY_DENOMINATOR: bigint =
  ACCURACY_SCALE_N ** BigInt(GUNNERY_ACCURACY_SCALE_EXPONENT);

export const HIT_DRAW_MIN = GUNNERY_ACCURACY_FINAL_MIN_BP;
export const HIT_DRAW_MAX = GUNNERY_ACCURACY_FINAL_MAX_BP - 1;

export type GunneryAccuracyFactors = {
  baseAccuracyBp: number;
} & Record<GunneryAccuracyFactorKey, number>;

export function neutralAccuracyFactors(baseAccuracyBp: number): GunneryAccuracyFactors {
  const multipliers = { ...GUNNERY_ACCURACY_NEUTRAL_FACTORS };
  return { baseAccuracyBp, ...multipliers };
}

export interface AccuracyRoundingDetail {
  mode: string;
  numerator: string;
  denominator: string;
  rawFlooredBp: number;
}

export interface AccuracyResolution {
  factorKeys: readonly GunneryAccuracyFactorKey[];
  factors: GunneryAccuracyFactors;
  finalAccuracyBp: number;
  rounding: AccuracyRoundingDetail;
}

export function resolveAccuracy(factors: GunneryAccuracyFactors): AccuracyResolution {
  if (!Number.isInteger(factors.baseAccuracyBp) || factors.baseAccuracyBp < 0) {
    throw new BluewaveError(GUNNERY_ACCURACY_FACTOR_MISSING, {
      code: GUNNERY_ACCURACY_FACTOR_MISSING,
      factorKey: "baseAccuracyBp",
      reason: "base accuracy must be a non-negative integer basis point",
      value: factors.baseAccuracyBp,
    });
  }
  let numerator: bigint = BigInt(factors.baseAccuracyBp);
  for (const key of GUNNERY_ACCURACY_FACTOR_KEYS) {
    const m: unknown = factors[key];
    if (m === undefined || m === null || !Number.isInteger(m)) {
      throw new BluewaveError(GUNNERY_ACCURACY_FACTOR_MISSING, {
        code: GUNNERY_ACCURACY_FACTOR_MISSING,
        factorKey: key,
        reason: "missing, undefined, or non-integer accuracy factor",
        value: m,
      });
    }
    numerator = numerator * BigInt(m as number);
  }
  const rawFloored: bigint = numerator / GUNNERY_ACCURACY_DENOMINATOR;
  const rawFlooredBp: number = Number(rawFloored);
  const finalAccuracyBp = Math.min(
    GUNNERY_ACCURACY_FINAL_MAX_BP,
    Math.max(GUNNERY_ACCURACY_FINAL_MIN_BP, rawFlooredBp),
  );
  return {
    factorKeys: GUNNERY_ACCURACY_FACTOR_KEYS,
    factors,
    finalAccuracyBp,
    rounding: {
      mode: GUNNERY_ACCURACY_ROUNDING,
      numerator: numerator.toString(),
      denominator: GUNNERY_ACCURACY_DENOMINATOR.toString(),
      rawFlooredBp,
    },
  };
}

export function isHit(finalAccuracyBp: number, draw: number): boolean {
  return draw < finalAccuracyBp;
}

export function gunneryHitStreamId(identity: {
  battleId: string;
  batteryId: string;
  minute: number;
  substep: number;
}): string {
  return `gunnery/accuracy/hit:${identity.battleId}:${identity.batteryId}:${identity.minute}:${identity.substep}`;
}

export interface KeyedHitDraw {
  streamId: string;
  entityKey: string;
  phase: string;
  rulesetVersion: string;
  inputHash: string;
  draw: number;
  finalAccuracyBp: number;
  isHit: boolean;
}

export function resolveHit(
  engine: RandomEngine,
  identity: {
    battleId: string;
    batteryId: string;
    minute: number;
    substep: number;
  },
  finalAccuracyBp: number,
): KeyedHitDraw {
  const streamId = gunneryHitStreamId(identity);
  const stream = engine.stream(streamId);
  const safeDraw = drawUniform(stream, SafeInt(HIT_DRAW_MIN), SafeInt(HIT_DRAW_MAX));
  const draw = safeDraw as number;
  const inputHash = sha256Hex(
    canonicalSerialize({
      identity,
      finalAccuracyBp,
      rulesetVersion: GUNNERY_RULESET_VERSION,
    }),
  );
  return {
    streamId,
    entityKey: `${identity.battleId}:${identity.batteryId}`,
    phase: "resolve_gunnery_accuracy",
    rulesetVersion: GUNNERY_RULESET_VERSION,
    inputHash,
    draw,
    finalAccuracyBp,
    isHit: isHit(finalAccuracyBp, draw),
  };
}
