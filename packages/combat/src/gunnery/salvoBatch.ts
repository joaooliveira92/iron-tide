// P-1 ticket 06 — salvo gun-count sensitivity, ADR-0048. `resolveOneBattery`
// takes exactly ONE keyed hit draw per salvo per minute (§3), so a 10-gun
// battery and a 1-gun battery were hit-equivalent. This module keeps the single
// draw (stream identity, ledger shape, one HIT -> one impact path — untouched)
// but replaces the per-round probability fed to that draw with the binomial
// equivalent of N INDEPENDENT per-round draws:
//
//   salvoBatchAccuracyBp(q, N) = 1 - (1 - q/10_000)^N, in basis points
//
// evaluated EXACTLY in integer arithmetic:
//
//   batchBp = 10_000 - ceil((10_000 - q)^N / 10_000^(N-1))
//
// (the "ceil" division is derived from 1 - (1 - q/10_000)^N = (10_000^N -
// (10_000 - q)^N) / 10_000^N, which is not integer in general; the ceiling is
// the exact integer round-up of the rational — the SAME one-final-rounding
// discipline DESIGN-39 §3 applies to the accuracy pipeline).
//
// Exact behavior:
//   N = 0     -> 0 (a zero-gun salvo cannot hit; only reachable by direct call —
//                the fire path always spends salvoCount >= 1 rounds);
//   N = 1     -> q (single gun = per-round probability, identity);
//   q = 0     -> 0;  q = 10_000 -> 10_000;
//   q in (0, 10_000), N >= 1 -> strictly between q and 10_000 (more guns
//                strictly raise the salvo hit chance, converging to 10_000).
//
// Documented deviation from floating-point examples: the exact integer result
// can differ by 1-2 bp from a float evaluation (e.g. q = 875, N = 4 gives
// 3_066 here; a naive 10_000 * (1 - 0.9125^4) float gives 3_066.85 -> 3_066 (floor),
// and some published examples print 3_067). The integer form is authoritative.
//
// Bound analysis (DESIGN-07): (10_000 - q) <= 10_000 and N is a salvoCount
// (committed rounds); both are small integers. Bigint handles any practical
// salvo; the guard at 1_000_000 keeps a malformed battery from constructing a
// ~10^(6*10^6)-digit intermediate.
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
  const missesCeil = (missesAny + units - 1n) / units; // ceil(miss^N / 10_000^(N-1))
  return Number(10_000n - missesCeil);
}
