import { BluewaveError } from "@bluewave/contracts";
import {
  GUNNERY_RATE_FACTOR_KEYS,
  GUNNERY_RATE_NEUTRAL_FACTORS,
  GUNNERY_RATE_ROUNDING,
  GUNNERY_RATE_SCALE_EXPONENT,
  GUNNERY_RULESET_VERSION,
  type GunneryRateFactorKey,
} from "./constants.js";
import {
  GUN_QUALITY_TABLE,
  GUN_QUALITY_MAX,
  GUN_QUALITY_MIN,
  type GunQualityMultipliers,
} from "./constants.js";
import { GUN_QUALITY_OUT_OF_RANGE, GUNNERY_RATE_FACTOR_MISSING } from "./reasonCodes.js";

const RATE_SCALE_N = 10_000n;
export const GUNNERY_RATE_DENOMINATOR: bigint = RATE_SCALE_N ** BigInt(GUNNERY_RATE_SCALE_EXPONENT);

const OPTIONAL_RATE_FACTOR_KEY: GunneryRateFactorKey = "gunQuality";

export type GunneryRateFactors = Record<Exclude<GunneryRateFactorKey, "gunQuality">, number> & {
  gunQuality?: number;
};

export function neutralRateFactors(): GunneryRateFactors {
  return { ...GUNNERY_RATE_NEUTRAL_FACTORS };
}

export interface RateRoundingDetail {
  mode: string;
  numerator: string;
  denominator: string;
  appliedCount: number;
  rawCeiledMs: number;
}

export interface EffectiveReloadResolution {
  factorKeys: readonly GunneryRateFactorKey[];
  factors: GunneryRateFactors;
  effectiveReloadMs: number;
  rounding: RateRoundingDetail;
}

export function computeEffectiveReloadMs(
  baseReloadMs: number,
  rateMultipliers: GunneryRateFactors,
): EffectiveReloadResolution {
  if (!Number.isInteger(baseReloadMs) || baseReloadMs <= 0) {
    throw new BluewaveError(GUNNERY_RATE_FACTOR_MISSING, {
      code: GUNNERY_RATE_FACTOR_MISSING,
      factorKey: "baseReloadMs",
      reason: "base reload must be a positive integer number of tactical milliseconds",
      value: baseReloadMs,
    });
  }

  let numerator: bigint = BigInt(baseReloadMs);
  let appliedCount = 0;
  const appliedKeys: GunneryRateFactorKey[] = [];
  for (const key of GUNNERY_RATE_FACTOR_KEYS) {
    const m: unknown = rateMultipliers[key];
    const absent = m === undefined || m === null;
    if (absent && key === OPTIONAL_RATE_FACTOR_KEY) continue;
    if (absent || !Number.isInteger(m)) {
      throw new BluewaveError(GUNNERY_RATE_FACTOR_MISSING, {
        code: GUNNERY_RATE_FACTOR_MISSING,
        factorKey: key,
        reason: "missing, undefined, or non-integer rate factor",
        value: m,
      });
    }
    numerator = numerator * BigInt(m as number);
    appliedCount += 1;
    appliedKeys.push(key);
  }
  const denominator = RATE_SCALE_N ** BigInt(appliedCount);
  const rawCeiled: bigint = (numerator + denominator - 1n) / denominator;
  const rawCeiledMs: number = Number(rawCeiled);

  return {
    factorKeys: [...appliedKeys],
    factors: rateMultipliers,
    effectiveReloadMs: rawCeiledMs,
    rounding: {
      mode: GUNNERY_RATE_ROUNDING,
      numerator: numerator.toString(),
      denominator: denominator.toString(),
      appliedCount,
      rawCeiledMs,
    },
  };
}

export function gunQualityMultipliers(quality: number): GunQualityMultipliers {
  if (!Number.isInteger(quality) || quality < GUN_QUALITY_MIN || quality > GUN_QUALITY_MAX) {
    throw new BluewaveError(GUN_QUALITY_OUT_OF_RANGE, {
      code: GUN_QUALITY_OUT_OF_RANGE,
      reason: "gun quality must be an integer within -3..+2 inclusive",
      quality,
    });
  }
  return GUN_QUALITY_TABLE[String(quality) as keyof typeof GUN_QUALITY_TABLE];
}

export function advanceReloadProgress(progressMs: number, deltaMs: number): number {
  if (!Number.isInteger(progressMs) || progressMs < 0) {
    throw new BluewaveError(GUNNERY_RATE_FACTOR_MISSING, {
      code: GUNNERY_RATE_FACTOR_MISSING,
      factorKey: "progressMs",
      reason: "reload progress must be a non-negative integer number of ms",
      value: progressMs,
    });
  }
  if (!Number.isInteger(deltaMs) || deltaMs < 0) {
    throw new BluewaveError(GUNNERY_RATE_FACTOR_MISSING, {
      code: GUNNERY_RATE_FACTOR_MISSING,
      factorKey: "deltaMs",
      reason: "reload advance must be a non-negative integer number of ms",
      value: deltaMs,
    });
  }
  return progressMs + deltaMs;
}

export function isReloadComplete(progressMs: number, effectiveReloadMs: number): boolean {
  return progressMs >= effectiveReloadMs;
}

export function resetReloadProgress(): number {
  return 0;
}

export function gunQualityRateMultiplierBp(quality: number): number {
  return gunQualityMultipliers(quality).rateBp;
}

export const gunQualityRulesetVersion = GUNNERY_RULESET_VERSION;
