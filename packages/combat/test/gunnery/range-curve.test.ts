// P-1 ticket 06 — the range-accuracy curve (`gunnery_range_v1`), BALANCE TARGET
// integers anchored to the Tsushima (1905) and Jutland (1916) heavy-gun hit-rate
// records (see the note `docs/research/p1-gun-accuracy-vs-range.md`). These
// tests lock the exact integer closed form:
//
//   R_yd = max(2_000, floor(rangeUm / 914_400))
//   H_bp = floor(10^8 / (10_000 + 7 * (R_yd - 2_000)))
//   q_bp = clamp(60, 1_500, round(3_000 * H_bp / 10_000))
//   rangeMultiplierBp = round(q_bp * 10_000 / 4_000)      (= round(q_bp * 2.5))
//
// and prove the multiplier reproduces the fallback table's 8 band edges exactly
// through the neutral base 4_000 (the auto-resolver's authored accuracy).
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  perRoundHitProbabilityBp,
  rangeMultiplierBp,
  rangeBetweenUm,
  RANGE_Q_CAP_BP,
  RANGE_Q_FLOOR_BP,
  RANGE_MULTIPLIER_REFERENCE_BASE_BP,
  BUORD_H_MIN_RANGE_YD,
  GUNNERY_RANGE_CURVE_VERSION,
} from "../../src/gunnery/index.js";
import { GUNNERY_ACCURACY_BASE_BP } from "../../src/battleResolution/constants.js";
import { INVALID_GUNNERY_STATE } from "../../src/gunnery/reasonCodes.js";

// band edge -> [q_bp, multiplier] from the note's fallback table. Every one of
// these is reproduced exactly by the closed form (verified by hand in the note).
const BANDS: ReadonlyArray<readonly [rangeUm: number, qBp: number, multiplierBp: number]> = [
  [3_000_000_000, 1_500, 3_750], // 3 km — q clamps at the 1_500 cap
  [5_000_000_000, 875, 2_188],
  [8_000_000_000, 524, 1_310],
  [12_000_000_000, 341, 853],
  [16_000_000_000, 253, 633],
  [20_000_000_000, 201, 503],
  [25_000_000_000, 160, 400],
  [40_000_000_000, 99, 248],
];

describe("gunnery_range_v1 (P-1 ticket 06) — range accuracy curve", () => {
  it("reproduces the 8-band fallback table exactly at every band edge", () => {
    for (const [rangeUm, qBp, multiplierBp] of BANDS) {
      expect(perRoundHitProbabilityBp(rangeUm), `q(${rangeUm} µm)`).toBe(qBp);
      expect(rangeMultiplierBp(rangeUm), `mult(${rangeUm} µm)`).toBe(multiplierBp);
    }
  });

  it("the §3 multiplier reproduces q exactly through the neutral 4_000 base", () => {
    // floor(baseAccuracyBp * Π multipliers / 10_000^16) with a single range
    // factor: floor(4_000 * mult / 10_000) must equal q at every band edge (and
    // for every q, per the derivation in rangeCurve.ts).
    for (const [rangeUm, qBp] of BANDS) {
      const mult = rangeMultiplierBp(rangeUm);
      const throughBase = Math.floor((GUNNERY_ACCURACY_BASE_BP * mult) / 10_000);
      expect(throughBase, `base 4_000 * mult(${rangeUm} µm)`).toBe(qBp);
    }
  });

  it("curve shape: monotone non-increasing, capped at 0-3 km, floored beyond ~65 km", () => {
    // Cap band: inside 0..3 km (and right at the 2_000 yd curve start) every
    // range hits the 1_500 bp cap.
    expect(perRoundHitProbabilityBp(0)).toBe(RANGE_Q_CAP_BP);
    expect(perRoundHitProbabilityBp(2_000_000_000)).toBe(RANGE_Q_CAP_BP);
    expect(perRoundHitProbabilityBp(3_000_000_000)).toBe(RANGE_Q_CAP_BP);

    // Strict decay over the mid band (one km step).
    const mid = [4, 6, 9, 11, 14, 18, 22, 30, 50].map((km) => km * 1_000_000_000);
    for (let i = 1; i < mid.length; i++) {
      expect(perRoundHitProbabilityBp(mid[i]!)).toBeLessThan(perRoundHitProbabilityBp(mid[i - 1]!));
    }

    // 60 km is above the floor; the floor engages at ~65.2 km and holds forever.
    expect(perRoundHitProbabilityBp(60_000_000_000)).toBeGreaterThan(RANGE_Q_FLOOR_BP);
    expect(perRoundHitProbabilityBp(66_000_000_000)).toBe(RANGE_Q_FLOOR_BP);
    expect(perRoundHitProbabilityBp(80_000_000_000)).toBe(RANGE_Q_FLOOR_BP);
    expect(perRoundHitProbabilityBp(Number.MAX_SAFE_INTEGER)).toBe(RANGE_Q_FLOOR_BP);
  });

  it("invalid ranges fail closed (never silently clamp)", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      let caught: unknown;
      try {
        perRoundHitProbabilityBp(bad as number);
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).message).toBe(INVALID_GUNNERY_STATE);
    }
  });

  it("exact integer distance between integer-micrometre positions", () => {
    expect(rangeBetweenUm([0, 0], [0, 0])).toBe(0);
    // 3-4-5 triangle scaled by 1e9 µm: 5e9 exactly.
    expect(rangeBetweenUm([0, 0], [3_000_000_000, 4_000_000_000])).toBe(5_000_000_000);
    expect(rangeBetweenUm([4_000_000_000, 5_000_000_000], [0, 0])).toBe(
      Math.floor(Math.sqrt(4_000_000_000 ** 2 + 5_000_000_000 ** 2)),
    );
    // Huge separations (positions may be ~1e11 µm apart) must not hit unsafe
    // squared-distance integers; the result is deterministic and finite.
    const far = rangeBetweenUm([0, 0], [2_000_000_000_00, 0]);
    expect(far).toBe(2_000_000_000_00);
    const far2 = rangeBetweenUm([0, 0], [1_000_000_000_00, 1_000_000_000_00]);
    expect(far2).toBe(Math.floor(1_000_000_000_00 * Math.SQRT2));
  });

  it("authored constants are the versioned curve identity", () => {
    expect(GUNNERY_RANGE_CURVE_VERSION).toBe("gunnery_range_v1");
    expect(RANGE_Q_CAP_BP).toBe(1_500);
    expect(RANGE_Q_FLOOR_BP).toBe(60);
    expect(BUORD_H_MIN_RANGE_YD).toBe(2_000);
    // The §3 slot conversion base and the auto-resolver's authored base accuracy
    // are the same integer — a drift here silently shifts every curve value.
    expect(RANGE_MULTIPLIER_REFERENCE_BASE_BP).toBe(GUNNERY_ACCURACY_BASE_BP);
  });
});
