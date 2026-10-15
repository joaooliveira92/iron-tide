//packages/combat/src/gunnery/rateOfFire.ts
// DESIGN-39 §4 rate-of-fire / reload resolution (INC-3). Reload is integer tactical
// milliseconds of work:
//
//   effectiveReloadMs = ceil(baseReloadMs * 10_000^n / Π rateMultipliersBp)
//
// where n = number of applied rate multipliers (10 or 11 — see below) and the
// multipliers apply in §4 order 1-11 (GUNNERY_RATE_FACTOR_KEYS). The exact integer
// rational is retained through all factors and rounded ONCE with CEIL at the end
// (contrasting accuracy's single FLOOR, §3). A missing/undefined/non-integer factor
// fails with GUNNERY_RATE_FACTOR_MISSING — never a silent 10_000 fallback.
//
// Gun-quality rate multiplier MAY be legally omitted: a gun/mount definition MAY
// declare that quality does not affect rate of fire (DESIGN-39 §5), in which case
// the gun-quality factor is excluded from the §4 product and n is reduced by one.
// Every OTHER factor must be present and explicit.
//
// Bound analysis (DESIGN-07): the numerator baseReloadMs * 10_000^11 can reach
// ~10^48, far above Number.MAX_SAFE_INTEGER (~9.0e15). This proves bigint necessary
// for the intermediate product; the ceiled effective reload is a plain non-negative
// integer safe result.
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

// Exact denominator 10_000^11 (bigint; 10^44 — within bigint, not Number range).
const RATE_SCALE_N = 10_000n;
export const GUNNERY_RATE_DENOMINATOR: bigint = RATE_SCALE_N ** BigInt(GUNNERY_RATE_SCALE_EXPONENT);

// gun-quality is the ONLY factor a definition MAY legally omit (no-rate-effect,
// DESIGN-39 §5). Every other factor MUST be present + integer.
const OPTIONAL_RATE_FACTOR_KEY: GunneryRateFactorKey = "gunQuality";

// All 11 factors present for the default (gun-quality affects rate) path.
export type GunneryRateFactors = Record<Exclude<GunneryRateFactorKey, "gunQuality">, number> & {
  gunQuality?: number;
};

// Build a fully-neutral factor set (all 11 multipliers = 10_000, gun-quality
// included). Helpful for callers/tests that only meaningfully vary a subset; the
// authored neutral constants live in constants.ts (GUNNERY_RATE_NEUTRAL_FACTORS).
export function neutralRateFactors(): GunneryRateFactors {
  return { ...GUNNERY_RATE_NEUTRAL_FACTORS };
}

export interface RateRoundingDetail {
  mode: string; // "ceil" — rounded once at the end, never truncated mid-product
  numerator: string; // exact rational numerator (bigint as decimal string)
  denominator: string; // exact rational denominator 10_000^n (n = applied count)
  appliedCount: number; // n = number of rate multipliers actually applied
  rawCeiledMs: number; // ceil(numerator/denominator) (non-negative integer)
}

export interface EffectiveReloadResolution {
  factorKeys: readonly GunneryRateFactorKey[];
  factors: GunneryRateFactors;
  effectiveReloadMs: number;
  rounding: RateRoundingDetail;
}

// AC-5: effectiveReloadMs = ceil(baseReloadMs * 10_000^n / Π rateMultipliersBp),
// factors applied in §4 order, exact integer retained, CEILED once. A missing /
// undefined / non-integer factor (other than the legally-omittable gun-quality)
// throws GUNNERY_RATE_FACTOR_MISSING. baseReloadMs must be a positive integer.
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
    // gun-quality MAY be legally omitted (no-rate-effect declaration, §5); every
    // other factor must be present.
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
  // Denominator = 10_000^appliedCount (n = number of applied multipliers).
  const denominator = RATE_SCALE_N ** BigInt(appliedCount);
  // bigint ceiling for non-negative values: (numerator + denominator - 1) / denominator.
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

// AC-6: gun-quality table lookup by integer quality (-3..+2 inclusive). Out-of-range
// quality fails with GUN_QUALITY_OUT_OF_RANGE.
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

// ---------------------------------------------------------------------------
// Reload progress in exact tactical milliseconds (§4). A battery fires only when
// progress >= effectiveReloadMs (isReloadComplete) AND all firing predicates pass;
// after firing, progress resets. The non-reload firing predicates are deferred to
// INC-4; this module exposes the reload-seam only.
// ---------------------------------------------------------------------------

// AC-5: advance reload progress by an exact non-negative number of tactical ms.
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

// AC-5: a battery's reload is complete (ready to fire, subject to the deferred
// firing predicates) exactly when progress reaches its effective duration.
export function isReloadComplete(progressMs: number, effectiveReloadMs: number): boolean {
  return progressMs >= effectiveReloadMs;
}

// AC-5: reset reload progress to 0 after a salvo fires.
export function resetReloadProgress(): number {
  return 0;
}

// Convenience: the gun-quality rate multiplier for a quality, for feeding the §4
// product with computeEffectiveReloadMs. Throws GUN_QUALITY_OUT_OF_RANGE for an
// out-of-range quality.
export function gunQualityRateMultiplierBp(quality: number): number {
  return gunQualityMultipliers(quality).rateBp;
}

export const gunQualityRulesetVersion = GUNNERY_RULESET_VERSION;
