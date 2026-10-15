// DESIGN-39 §3 accuracy resolution (INC-2): the exact basis-point rational value
// is retained through ALL 16 multiplier factors and rounded ONCE with FLOOR at
// the final accuracy check (never truncated mid-product). A missing/undefined
// factor fails with GUNNERY_ACCURACY_FACTOR_MISSING — never a silent 10_000
// fallback. The hit check compares ONE keyed integer draw 0..9_999 from a
// domain-separated @bluewave/random stream against finalAccuracyBp, succeeding
// exactly when draw < finalAccuracyBp (§3).
//
// Bound analysis (DESIGN-07): the raw numerator baseAccuracyBp * Π multiplierBp
// can reach ~10^68 (17 factors each <= 10_000), far above Number.MAX_SAFE_INTEGER
// (~9.0e15). This proves bigint necessary for the intermediate product; the
// floored, clamped result is always in [0, 10_000] and fits a plain safe integer.
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

// Exact denominator 10_000^16 (bigint; 10^64 — within bigint, not Number range).
const ACCURACY_SCALE_N = 10_000n;
export const GUNNERY_ACCURACY_DENOMINATOR: bigint =
  ACCURACY_SCALE_N ** BigInt(GUNNERY_ACCURACY_SCALE_EXPONENT);

export const HIT_DRAW_MIN = GUNNERY_ACCURACY_FINAL_MIN_BP; // 0
export const HIT_DRAW_MAX = GUNNERY_ACCURACY_FINAL_MAX_BP - 1; // 9_999

export type GunneryAccuracyFactors = {
  baseAccuracyBp: number;
} & Record<GunneryAccuracyFactorKey, number>;

// Build a fully-neutral factor set (all 16 multipliers = 10_000). Helpful for
// callers/tests that only meaningfully vary baseAccuracyBp; the authored neutral
// constants live in constants.ts (GUNNERY_ACCURACY_NEUTRAL_FACTORS).
export function neutralAccuracyFactors(baseAccuracyBp: number): GunneryAccuracyFactors {
  const multipliers = { ...GUNNERY_ACCURACY_NEUTRAL_FACTORS };
  return { baseAccuracyBp, ...multipliers };
}

export interface AccuracyRoundingDetail {
  mode: string; // "floor" — rounded once, never truncated mid-product
  numerator: string; // exact rational numerator (bigint as decimal string)
  denominator: string; // exact rational denominator 10_000^16
  rawFlooredBp: number; // floor(numerator/denominator) before clamping (safe int)
}

export interface AccuracyResolution {
  factorKeys: readonly GunneryAccuracyFactorKey[];
  factors: GunneryAccuracyFactors;
  finalAccuracyBp: number; // clamped + floored exact basis points
  rounding: AccuracyRoundingDetail;
}

// AC-3: finalAccuracyBp = clamp(0, 10_000, floor(baseAccuracyBp * Π multiplierBp / 10_000^16)).
// Exact integer rational retained through all factors; one FLOOR at the end; a
// missing/undefined/non-integer factor throws GUNNERY_ACCURACY_FACTOR_MISSING.
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
  // bigint integer division floors (all values non-negative).
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

// AC-4a: pure hit predicate. Succeeds exactly when draw < finalAccuracyBp (§3).
export function isHit(finalAccuracyBp: number, draw: number): boolean {
  return draw < finalAccuracyBp;
}

// Domain-separated keyed stream id for one battery's hit draw at a (minute,
// substep). B-2 spotting keyed-stream idiom, stable for identical identity.
export function gunneryHitStreamId(identity: {
  battleId: string;
  batteryId: string;
  minute: number;
  substep: number;
}): string {
  return `gunnery/accuracy/hit:${identity.battleId}:${identity.batteryId}:${identity.minute}:${identity.substep}`;
}

// AC-4: result of a keyed hit draw, carrying the draw + random-decision fields so
// INC-4 can embed it in the GunneryEventRecord (and a RandomDecision).
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
