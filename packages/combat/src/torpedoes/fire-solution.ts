//packages/combat/src/torpedoes/fire-solution.ts
// DESIGN-40 §10 fire-solution quality (INC-3): the exact basis-point rational
// value is retained through ALL TEN multiplier factors and rounded ONCE with
// FLOOR at the final quality (never truncated mid-product). A missing/undefined
// factor fails with TORPEDO_FIRE_SOLUTION_FACTOR_MISSING — never a silent 10_000
// fallback (mirrors gunnery/accuracy.ts GUNNERY_ACCURACY_FACTOR_MISSING).
//
// The shipped 11-factor manifest maps the §9 knowledge inputs as follows
// (the engine stage INC-7 computes each multiplier from the firing side's
// knowledge; this slice ships the manifest + exact product + authored neutrals):
//   baseSolutionBp  <- launcher geometry, selected torpedo setting, and the
//                      §9 target-contact uncertainty (a base "solution quality")
//   range           <- target estimated range
//   bearing         <- target relative bearing / deflection
//   targetMotion    <- target estimated speed, estimated course, maneuver history
//   ownManeuver     <- own turn rate / own maneuver within the fire-control limit
//   crew            <- crew quality
//   training        <- torpedo-tactics training
//   seaState        <- sea state
//   visibility      <- visibility and identification quality
//   technology      <- fire-control technology
//   damage          <- launcher damage
//
// Bound analysis (ENGINEERING-CONTRACT): the raw numerator
// baseSolutionBp * Π multiplierBp reaches ~10^44 (11 factors each <= 10_000),
// far above Number.MAX_SAFE_INTEGER (~9.0e15). This proves bigint necessary for
// the intermediate product; the floored, clamped result is always in
// [0, 10_000] and fits a plain safe integer.
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

// Exact denominator 10_000^10 (bigint; 10^40 — within bigint, not Number range).
const SOLUTION_SCALE_N = 10_000n;
export const TORPEDO_SOLUTION_DENOMINATOR: bigint =
  SOLUTION_SCALE_N ** BigInt(TORPEDO_SOLUTION_SCALE_EXPONENT);

// The full §10 manifest: baseSolutionBp plus every multiplier factor. All
// numeric fields are integer basis-point values.
export type TorpedoSolutionFactors = {
  baseSolutionBp: number;
} & Record<TorpedoSolutionFactorKey, number>;

// Build a fully-neutral factor set (all ten multipliers = 10_000 bp). Helpful
// for callers/tests that only meaningfully vary baseSolutionBp; the authored
// neutral constant lives in constants.ts (NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP).
export function neutralTorpedoSolutionFactors(baseSolutionBp: number): TorpedoSolutionFactors {
  const multipliers = {} as Record<TorpedoSolutionFactorKey, number>;
  for (const key of TORPEDO_SOLUTION_FACTOR_KEYS) {
    multipliers[key] = NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP;
  }
  return { baseSolutionBp, ...multipliers };
}

export interface TorpedoSolutionRoundingDetail {
  mode: string; // "floor" — rounded once, never truncated mid-product
  numerator: string; // exact rational numerator (bigint as decimal string)
  denominator: string; // exact rational denominator 10_000^10
  rawFlooredBp: number; // floor(numerator/denominator) before clamping (safe int)
}

export interface TorpedoSolutionResolution {
  factorKeys: readonly TorpedoSolutionFactorKey[];
  factors: TorpedoSolutionFactors;
  solutionQualityBp: number; // clamped + floored exact basis points
  rounding: TorpedoSolutionRoundingDetail;
}

// AC-9: solutionQualityBp = clamp(0, 10_000, floor(baseSolutionBp * Π multiplierBp / 10_000^10)).
// Exact integer rational retained through all factors; one FLOOR at the end; a
// missing/undefined/non-integer OR out-of-range ([0, 10_000]) factor throws
// TORPEDO_FIRE_SOLUTION_FACTOR_MISSING — never a silent 10_000 fallback and
// never a silently-off-scale multiplier (mirrors the gunnery factor-missing
// family GUNNERY_ACCURACY_FACTOR_MISSING in gunnery/accuracy.ts, extended with
// the range bound as a hardening delta). The base is guarded non-negative
// integer (unbounded above: a base above 10_000 is the legitimate path that
// exercises the final clamp; the OUTPUT is always clamped to [0, 10_000]).
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
    const multiplier = m as number; // guarded integer above
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
  // bigint integer division floors (all values non-negative).
  const rawFloored: bigint = numerator / TORPEDO_SOLUTION_DENOMINATOR;
  // Diagnostic guard: with bounded factors (<= 10_000) and a safe-integer base
  // the raw value is itself a safe integer, but an absurd (still-isInteger)
  // base such as 1e30 would make Number(rawFloored) lossy. Saturate the
  // DIAGNOSTIC at Number.MAX_SAFE_INTEGER in that case — the authoritative
  // clamped solutionQualityBp below remains exact regardless.
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

// AC-10: the shipped §10 minimum for a launch kind, raised to the §24
// friendly-danger-sector 7_500 bp when a friendly/unidentified/low-confidence
// contact is inside the launch danger sector. The §24 prohibition (confirmed
// friendly below 1_000 m separation) is the friendlyFireSafety predicate's
// verdict — it overrides any quality minimum and is never waivable by manual
// launch; the Captain-mode manual override only ever lowers a NON-friendly
// threshold down to 4_000 bp (command-layer seam, documented in the ticket).
export function minimumSolutionQualityBp(
  launchKind: TorpedoLaunchKind,
  friendlyInDangerSector: boolean,
): number {
  if (friendlyInDangerSector) return TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP;
  return TORPEDO_SOLUTION_MINIMUM_BP[launchKind];
}

// AC-10: pure threshold check over an already-computed integer quality value.
export function solutionMeetsMinimum(
  solutionQualityBp: number,
  launchKind: TorpedoLaunchKind,
  friendlyInDangerSector: boolean,
): boolean {
  return solutionQualityBp >= minimumSolutionQualityBp(launchKind, friendlyInDangerSector);
}
