import { BluewaveError } from "@bluewave/contracts";
import { INVALID_GUNNERY_STATE } from "./reasonCodes.js";

export const SALVO_BATCH_VERSION = "gunnery_salvo_batch_v1";

export const SALVO_BATCH_MAX_GUARD = 1_000_000;

export function salvoBatchAccuracyBp(perRoundAccuracyBp: number, salvoCount: number): number {
  if (
    !Number.isInteger(perRoundAccuracyBp) ||
    perRoundAccuracyBp < 0 ||
    perRoundAccuracyBp > 10_000
  ) {
    throw new BluewaveError(INVALID_GUNNERY_STATE, {
      code: INVALID_GUNNERY_STATE,
      field: "perRoundAccuracyBp",
      reason: "per-round accuracy must be an integer basis point in [0, 10_000]",
      value: perRoundAccuracyBp,
    });
  }
  if (!Number.isInteger(salvoCount) || salvoCount < 0 || salvoCount > SALVO_BATCH_MAX_GUARD) {
    throw new BluewaveError(INVALID_GUNNERY_STATE, {
      code: INVALID_GUNNERY_STATE,
      field: "salvoCount",
      reason: "salvo count must be a non-negative integer within the batch guard",
      value: salvoCount,
    });
  }
  if (salvoCount === 0) return 0;
  const q = BigInt(perRoundAccuracyBp);
  const miss = 10_000n - q;
  const missesAny = miss ** BigInt(salvoCount);
  const units = 10_000n ** BigInt(salvoCount - 1);
  const missesCeil = (missesAny + units - 1n) / units;
  return Number(10_000n - missesCeil);
}
