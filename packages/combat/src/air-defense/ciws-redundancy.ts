// packages/combat/src/air-defense/ciws-redundancy.ts
// D-4 M4 Aviation: Air Defense — AC-10 CIWS redundancy per DESIGN-45 §15/§16.
//
// §15 "CIWS System Definition": one CIWS system is one independent terminal-defense mount
// with its own engagement channel and compatible sensor or local-control path; multiple
// barrels of one mount count as one CIWS system unless the definition declares independent
// channels (§15 lines 262-264). "A damaged, unpowered, empty, jammed, or out-of-arc CIWS
// system contributes zero" (§15 line 266) — such systems do NOT count toward the redundant
// set (the caller filters them out before counting; see isCiwsContributingSystem below).
//
// §16 "CIWS Redundancy": marginal effectiveness multipliers per defended ship: systems
// 1..4 → 10_000 bp each; 5..6 → 5_000; 7..8 → 1_500; 9+ → 500 (§16 lines 272-275). The
// first four systems provide full normal value; five and six reduced value; above six
// strongly redundant. The schedule is a marginal-effectiveness schedule, NOT a construction
// cap (§16 line 289) — any number of systems is legal input and each contributes its 9+
// residual 500.
//
// INC-4 embeds the exact §16 rational into §19's integer product
//   base × director × radar × crew × damage × ammunition × targetProfile × weather ×
//   saturation / 10_000^8
// by keeping the UNDIVIDED marginal sum in the `saturationBp` numerator slot: e.g. 4 CIWS
// systems → saturationBp = 40_000 (the exact rational 4.0). NO per-group rounding happens
// at this layer — the owning formula rounds once (§19 line 326). The schedule defines
// values only for system counts ≥ 1; a defended ship with no contributing CIWS system
// retains the NEUTRAL saturation factor 10_000 (the engagement-formula consumer-side
// neutral, mirroring the §14 groups-0 guidance — not a §16 value).
//
// SLOT MAPPING (orchestrator-decided, INC-4): `saturationBp` (the §19 `saturationMultiplierBp`
// slot) ← this module (§16). `directorBp` ← director-scaling.ts (§12). `radarBp` ←
// radar-saturation.ts (§14). crew/damage/ammunition stay INC-3 computed; targetProfile and
// weather are neutral-or-later concerns (INC-5/6). Engine call site wired in INC-6.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import { CIWS_REDUNDANCY_TABLE, ciwsMarginalMultiplierBp } from "./constants.js";
import { CIWS_DIMINISHING_RETURNS_ACTIVE, CIWS_STRONG_REDUNDANCY_ACTIVE } from "./reasonCodes.js";

/** The consumer-side neutral saturation factor (mirrors the §14 groups-0 neutral); §16
 *  itself defines values only for system counts ≥ 1. */
export const CIWS_NEUTRAL_FACTOR_BP = 10_000 as const;

// ---- §15 contribution predicate ----

/**
 * D: AC-10 (§15 line 266) — a CIWS system contributes to the redundant set only when it is
 * NOT damaged, unpowered, empty, jammed, or out of arc. The caller filters the ship's CIWS
 * systems through this predicate before counting; non-contributing systems contribute zero
 * and do not count toward the §16 schedule.
 */
export function isCiwsContributingSystem(input: {
  damaged: boolean;
  unpowered: boolean;
  empty: boolean;
  jammed: boolean;
  outOfArc: boolean;
}): boolean {
  return !(input.damaged || input.unpowered || input.empty || input.jammed || input.outOfArc);
}

// ---- §16 redundancy factor ----

/**
 * D: AC-10 (§16 lines 272-275) — the §19 `saturationBp` slot for a defended ship's
 * CONTRIBUTING CIWS system count: Σ_{n=1..count} marginal(n) with the canonical schedule
 * 1..4 → 10_000, 5..6 → 5_000, 7..8 → 1_500, 9+ → 500 — the UNDIVIDED sum kept in the
 * numerator (exact rational, no per-group rounding; see module comment). Count 0 (no
 * contributing systems) → the NEUTRAL saturation factor 10_000 (consumer-side neutral; §16
 * defines only counts ≥ 1). Fail-closed: a negative or non-integer count throws
 * INVALID_AIR_DEFENSE_STATE. The schedule is NOT a construction cap — large counts are
 * legal input and every system above the eighth contributes the 9+ residual 500.
 */
export function computeCiwsSaturationFactorBp(ciwsSystemCount: number): SafeInt {
  if (!SafeInt.isSafeInt(ciwsSystemCount) || ciwsSystemCount < 0) {
    throw new BluewaveError(
      "computeCiwsSaturationFactorBp: ciwsSystemCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, ciwsSystemCount },
    );
  }
  if (ciwsSystemCount === 0) {
    return SafeInt(CIWS_NEUTRAL_FACTOR_BP);
  }
  let sumBp = SafeInt.ZERO;
  const scheduleLength = CIWS_REDUNDANCY_TABLE.length; // 9 — the last canonical schedule row
  const bounded = Math.min(ciwsSystemCount, scheduleLength);
  for (let n = 1; n <= bounded; n++) {
    sumBp = SafeInt.add(sumBp, SafeInt(ciwsMarginalMultiplierBp(n)));
  }
  if (ciwsSystemCount > bounded) {
    // Systems 9+ each contribute exactly the 9+ marginal (500) — closed form, no loop. The
    // SafeInt multiply/add keeps the closed-form continuation overflow-checked exactly like
    // the loop: a count so large the aggregate would overflow is rejected fail-closed
    // (LOW-5 repair).
    sumBp = SafeInt.add(
      sumBp,
      SafeInt.mul(SafeInt(ciwsSystemCount - bounded), SafeInt(ciwsMarginalMultiplierBp(bounded))),
    );
  }
  return sumBp;
}

/**
 * §28 markers accompanying the §16 factor: count 5..6 →
 * [CIWS_DIMINISHING_RETURNS_ACTIVE]; count ≥ 7 → [CIWS_STRONG_REDUNDANCY_ACTIVE]; otherwise
 * none. The full §28 code rollup lands in INC-5.
 */
export function ciwsSaturationMarkers(ciwsSystemCount: number): ReadonlyArray<string> {
  if (!SafeInt.isSafeInt(ciwsSystemCount) || ciwsSystemCount < 0) {
    throw new BluewaveError(
      "ciwsSaturationMarkers: ciwsSystemCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, ciwsSystemCount },
    );
  }
  if (ciwsSystemCount >= 7) {
    return [CIWS_STRONG_REDUNDANCY_ACTIVE];
  }
  if (ciwsSystemCount >= 5) {
    return [CIWS_DIMINISHING_RETURNS_ACTIVE];
  }
  return [];
}
