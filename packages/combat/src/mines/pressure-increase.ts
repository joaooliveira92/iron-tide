// DESIGN-35 §5 mine-pressure increase / reinforcement (INC-2):
//
//   addedPressure = min(1_000_000 - currentPressure, effectiveLayingValue)
//
// A record reaching 1_000_000 cannot receive additional pressure until decay or
// sweeping lowers it (computeAddedPressure returns 0 at saturation).
// Reinforcement updates source composition and freshness through a weighted
// integer calculation, never resetting all pressure to full freshness:
//
//   newFreshnessBp = floor( (olderPressure * oldFreshnessBp +
//                            addedPressure * fullFreshnessPerType) / newPressure )
//
// with fullFreshnessPerType = 10_000 (§1's generic fresh-per basis points; a
// mine-type-specific fresh-per value would narrow it — no narrower value is
// shipped by DESIGN-35, so the generic 10_000 applies). Any attempted
// post-increase pressure outside 1..1_000_000 fails with
// INVALID_MINE_PRESSURE_STATE. Pure/deterministic: no I/O/clock/random; the
// updated record is a NEW immutable object.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_PRESSURE_MAX,
  MINE_PRESSURE_MIN,
  type AreaMinePressureRecord,
  type OrderedSourceCompositionItem,
  withAreaMinePressureRecordHash,
} from "./pressure-record.js";
import { MINE_BASIS_POINTS_PER_UNIT } from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE } from "./reasonCodes.js";

// §5 full-freshness constant for the weighted freshness law (generic; §1/§4
// "full freshness" per mine type defaults to 10_000 basis points — see the
// weighted formula comment above and ticket 04's generic-table reading).
export const MINE_FULL_FRESHNESS_BP = MINE_BASIS_POINTS_PER_UNIT;

// AC-5: addedPressure = min(1_000_000 - currentPressure, effectiveLayingValue).
// currentPressure >= 1_000_000  -> 0 (saturation blocks further addition until
// decay or sweeping reduces the record). effectiveLayingValue of 0 or less
// (unsupported/fuel-ineligible source, inoperative damage) also produces 0.
export function computeAddedPressure(
  currentPressure: SafeInt,
  effectiveLayingValue: SafeInt,
): SafeInt {
  if (!SafeInt.isSafeInt(currentPressure) || currentPressure < MINE_PRESSURE_MIN)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "currentPressure",
      reason:
        "current pressure must be an active-record value within 1..1_000_000 (0 means absence of a record, §1)",
      value: currentPressure,
    });
  if (!SafeInt.isSafeInt(effectiveLayingValue) || effectiveLayingValue < 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "effectiveLayingValue",
      reason: "effective laying value must be a non-negative integer",
      value: effectiveLayingValue,
    });
  if (currentPressure >= MINE_PRESSURE_MAX) return SafeInt.ZERO;
  const headroom = SafeInt.sub(SafeInt(MINE_PRESSURE_MAX), currentPressure);
  return SafeInt(Math.min(headroom as number, effectiveLayingValue as number));
}

// AC-5: reinforcePressureRecord returns an updated AreaMinePressureRecord with:
// - pressure = currentPressure + addedPressure (never above 1_000_000; the
//   §5 clamp keeps it in range, enforced by the post-guard below);
// - freshness updated via the §5 weighted-integer freshness law — the old
//   member keeps its own (possibly decayed) freshness, so a reinforcement
//   NEVER resets the whole field to full freshness;
// - source composition updated (merge-or-append by layingSourceId);
// - lastReinforcedMonth set to campaignMonth; lastDecayedMonth and
//   lastSweptMonth preserved as-is;
// - ordered targetBelligerents replaced by the caller's ordered set;
// - recordHash recomputed.
// Throws INVALID_MINE_PRESSURE_STATE if the post-increase pressure would fall
// outside 1..1_000_000 (unreachable via the clamp, but enforced sharp-closed).
export function reinforcePressureRecord(
  record: AreaMinePressureRecord,
  effectiveLayingValue: SafeInt,
  layingSourceId: string,
  campaignMonth: SafeInt,
  targetBelligerents: readonly string[],
): AreaMinePressureRecord {
  const addedPressure = computeAddedPressure(record.pressure, effectiveLayingValue);

  // §4: a zero/negative laying value (unsupported or fuel-ineligible source)
  // means no laying occurs — it must not mutate the record (no pressure change,
  // no spurious zero-contribution composition entry). Fail closed rather than
  // silently recording a non-event.
  if (effectiveLayingValue <= 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "effectiveLayingValue",
      reason:
        "a zero or negative laying value means no laying (§4); reinforcement requires a positive value",
      value: effectiveLayingValue,
    });

  const newPressure: SafeInt = SafeInt.add(record.pressure, addedPressure);

  // Post-condition guard — the §5 clamp makes this unreachable by construction,
  // but an invalid record input must never produce a silently corrupted one.
  if (addedPressure < 0 || newPressure < MINE_PRESSURE_MIN || newPressure > MINE_PRESSURE_MAX)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "pressure",
      reason: "post-increase pressure must remain within 1..1_000_000 (§5)",
      value: { currentPressure: record.pressure, addedPressure, newPressure },
    });

  // §5 weighted-integer freshness law: the old share keeps its own freshness,
  // the added share enters at full freshness. newPressure >= 1 (guard above),
  // so the division is well-defined; bigint division floors exactly.
  const olderPressure = BigInt(record.pressure);
  const oldFreshness = BigInt(record.freshnessBp);
  const added = BigInt(addedPressure);
  const newPressureBig = BigInt(newPressure);
  const freshnessNumerator = olderPressure * oldFreshness + added * BigInt(MINE_FULL_FRESHNESS_BP);
  const newFreshnessBp: number = Number(freshnessNumerator / newPressureBig);
  const newFreshnessSafe = SafeInt(newFreshnessBp);

  // Source composition: merge-into-existing (add contributing value + count) or
  // append a new ordered entry, deterministically (same input -> same order).
  const composed: OrderedSourceCompositionItem[] = [];
  let merged = false;
  for (const item of record.sourceComposition) {
    if (item.layingSourceId === layingSourceId) {
      composed.push({
        layingSourceId,
        contributingValue: SafeInt.add(SafeInt(item.contributingValue), addedPressure),
        count: SafeInt.add(SafeInt(item.count), SafeInt.ONE),
      });
      merged = true;
    } else {
      composed.push(item);
    }
  }
  if (!merged) {
    composed.push({
      layingSourceId,
      contributingValue: addedPressure,
      count: SafeInt.ONE,
    });
  }

  if (!Array.isArray(targetBelligerents) || targetBelligerents.length === 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "targetBelligerents",
      reason: "ordered target belligerents must be non-empty (§5 reinforcement)",
      value: targetBelligerents,
    });

  const updated: Omit<AreaMinePressureRecord, "recordHash"> = {
    ...record,
    pressure: newPressure,
    freshnessBp: newFreshnessSafe,
    sourceComposition: composed,
    lastReinforcedMonth: campaignMonth,
    targetBelligerents: [...targetBelligerents],
  };
  return withAreaMinePressureRecordHash(updated);
}
