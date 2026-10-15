//packages/combat/src/gunnery/rangeCurve.ts
// P-1 ticket 06 — auto-resolution gunnery fidelity (range + gun count), ADR-0048
// follow-up to ADR-0046. This module supplies the two inputs the resolver was
// missing:
//
//   1. A per-round hit-probability curve over the TRUE legal contact range each
//      minute, converted into the DESIGN-39 §3 `rangeMultiplierBp` accuracy
//      factor. Done as a hyperbolic 1/R falloff (dispersion-basis PHYSICS-1/R):
//      lateral dispersion, range-keeping error and the range band all grow about
//      linearly with range, so per-round hitting against a fixed target decays
//      roughly ∝ 1/R. The curve is anchored to the two best-documented 1880-1945
//      heavy-gun engagements (see the balance-target note below).
//   2. A salvo batch probability, `salvoBatchAccuracyBp`, so that a battery's
//      SALVO COUNT changes hit outcomes (binomial-equivalent batch BEFORE the
//      single keyed draw; see it in salvoBatch.ts).
//
// BALANCE TARGET note (`docs/research/p1-gun-accuracy-vs-range.md`):
//   * Tsushima 1905 (USNI Proceedings, Apr/Oct 1906): ~1,275 Japanese 12-in
//     rounds fired, ~250 hits ≈ 19.6 % per-round at ~4.6-7.3 km.
//   * Jutland 1916 (USNI Proceedings, Sep 1921; Campbell "Jutland"): ~2-4 %
//     heavy-calibre hits per round at ~11-16 km.
//   * The shipped integers below are BALANCE TARGETs, not normative physics:
//     the curve is calibrated (to the legacy band table, not the anchors) so that the per-round
//     probability reproduces the anchored fallback table exactly at its 8 band
//     edges (3/5/8/12/16/20/25/40 km -> 1500/875/524/341/253/201/160/99 bp),
//     capped at 1_500 bp and floored at 60 bp by design.
//
// All arithmetic is exact fixed-point integer: micrometre ranges stay integers,
// H and q use one floor / one rounded division, and the §3 multiplier mapping
// reproduces every band value exactly through the neutral base
// (RANGE_MULTIPLIER_REFERENCE_BASE_BP = GUNNERY_ACCURACY_BASE_BP, kept
// consistent by a test — the gunnery module MUST NOT import battleResolution,
// dependency direction).
import { BluewaveError } from "@bluewave/contracts";
import { INVALID_GUNNERY_STATE } from "./reasonCodes.js";

// Curve identity — every authored constant below is versioned with this id so a
// future re-fit is an explicit new ruleset, never an in-place edit (DESIGN-39 §3:
// "Every multiplier MUST be explicit and versioned").
export const GUNNERY_RANGE_CURVE_VERSION = "gunnery_range_v1";

// Per-round hit probability is discounted to a per-minute, per-gun BALANCE TARGET
// basis. 0.30 = 3_000 bp — one of the two fit levers against the historical
// per-round anchors above.
export const BATTLE_DISCOUNT_BP = 3_000;

// q curve clamps (basis points of the per-minute per-gun hit probability).
export const RANGE_Q_CAP_BP = 1_500;
export const RANGE_Q_FLOOR_BP = 60;

// Curve start: the hyperbolic branch begins at 2 000 yd; closer ranges evaluate
// at R = 2 000 yd (the cap band). 914 400 µm = 1 yd (exact).
export const BUORD_H_MIN_RANGE_YD = 2_000;
export const BUORD_H_SCALE_YD = 914_400;

// The §3 accuracy slot is a multiplier applied to baseAccuracyBp; a range
// multiplier of 10_000 is neutral. The curve's q_bp is converted through this
// reference base so that base 4_000 (the auto-resolver's authored accuracy) x
// multiplier / 10_000 reproduces q exactly. The reference base MUST equal
// GUNNERY_ACCURACY_BASE_BP (checked by a dedicated consistency test).
export const RANGE_MULTIPLIER_REFERENCE_BASE_BP = 4_000;

// perRoundHitProbabilityBp(rangeUm) — the q(R) curve.
//
//   R_yd = max(2_000, floor(rangeUm / 914_400))
//   H_bp = floor(10^8 / (10_000 + 7 * (R_yd - 2_000)))        [per-round prob]
//   q_bp = clamp(60, 1_500, round(3_000 * H_bp / 10_000))     [minute/gun basis]
//
// The "7" denominator slope is the second fit lever: with H(5 km) ≈ 29 % and
// H(12 km) ≈ 11 %, the round-half-up q reproduces the fallback table's 8 band
// edges exactly (verified in range-curve.test.ts):
//
//   range     R_yd   H_bp     q_bp   multiplier
//   3 km      3 280   5 274  1 500   3 750   (q clamps at the 1_500 cap)
//   5 km      5 468   2 917    875   2 188
//   8 km      8 748   1 747    524   1 310
//  12 km     13 123   1 138    341     853
//  16 km     17 497     844    253     633
//  20 km     21 872     670    201     503
//  25 km     27 340     533    160     400
//  40 km     43 744     330     99     248
//
// Monotone non-increasing in rangeUm (H strictly decreasing, round + clamps
// preserve weak monotonicity); bounded analysis (DESIGN-07): rangeUm may be any
// non-negative integer micrometre distance (positions <= ~1e11 µm; callers may
// pass anything), R_yd <= ~1e10 and the denominator stays far below
// Number.MAX_SAFE_INTEGER. Exact integer the whole way.
export function perRoundHitProbabilityBp(rangeUm: number): number {
  if (!Number.isInteger(rangeUm) || rangeUm < 0) {
    throw new BluewaveError(INVALID_GUNNERY_STATE, {
      code: INVALID_GUNNERY_STATE,
      field: "rangeUm",
      reason: "range must be a non-negative integer micrometre distance",
      value: rangeUm,
    });
  }
  const rangeYd = Math.max(BUORD_H_MIN_RANGE_YD, Math.floor(rangeUm / BUORD_H_SCALE_YD));
  const hBp = Math.floor(100_000_000 / (10_000 + 7 * (rangeYd - BUORD_H_MIN_RANGE_YD)));
  const qBp = Math.round((BATTLE_DISCOUNT_BP * hBp) / 10_000);
  return Math.min(RANGE_Q_CAP_BP, Math.max(RANGE_Q_FLOOR_BP, qBp));
}

// rangeMultiplierBp(rangeUm) — the DESIGN-39 §3 `range` accuracy factor for a
// firing solution at `rangeUm` micrometres. integer = round(q_bp * 10_000 /
// RANGE_MULTIPLIER_REFERENCE_BASE_BP) = round(q_bp * 2.5), half-up. A neutral
// base of 4_000 therefore reproduces q exactly at every band edge AND at every
// q (floor(0.4 * round(2.5 q)) == q for all integer q in [0, 10_000]: when
// 2.5 q is integral the floor is exact, when it ends in .5 the round-up
// contributes 0.2 to the 0.4 product, still below the next integer).
export function rangeMultiplierBp(rangeUm: number): number {
  const qBp = perRoundHitProbabilityBp(rangeUm);
  return Math.round((qBp * 10_000) / RANGE_MULTIPLIER_REFERENCE_BASE_BP);
}

// Distance between two integer-micrometre positions, floored to an integer
// micrometre length. Uses the max-normalized hypotenuse (no raw dx^2+dy^2 —
// positions may be ~1e11 µm apart, whose squared distance exceeds
// Number.MAX_SAFE_INTEGER; the normalized form keeps every intermediate value
// <= ~2.9e10, exactly representable, and is byte-deterministic across
// processes — the same IEEE operations on the same integers).
export function rangeBetweenUm(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  const m = Math.max(dx, dy);
  if (m === 0) return 0;
  const nx = dx / m;
  const ny = dy / m;
  return Math.floor(m * Math.sqrt(nx * nx + ny * ny));
}
