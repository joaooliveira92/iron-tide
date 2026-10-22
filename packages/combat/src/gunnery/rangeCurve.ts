import { BluewaveError } from "@bluewave/contracts";
import { INVALID_GUNNERY_STATE } from "./reasonCodes.js";

export const GUNNERY_RANGE_CURVE_VERSION = "gunnery_range_v1";

export const BATTLE_DISCOUNT_BP = 3_000;

export const RANGE_Q_CAP_BP = 1_500;
export const RANGE_Q_FLOOR_BP = 60;

export const BUORD_H_MIN_RANGE_YD = 2_000;
export const BUORD_H_SCALE_YD = 914_400;

export const RANGE_MULTIPLIER_REFERENCE_BASE_BP = 4_000;

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

export function rangeMultiplierBp(rangeUm: number): number {
  const qBp = perRoundHitProbabilityBp(rangeUm);
  return Math.round((qBp * 10_000) / RANGE_MULTIPLIER_REFERENCE_BASE_BP);
}

export function rangeBetweenUm(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  const m = Math.max(dx, dy);
  if (m === 0) return 0;
  const nx = dx / m;
  const ny = dy / m;
  return Math.floor(m * Math.sqrt(nx * nx + ny * ny));
}
