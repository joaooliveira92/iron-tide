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

export const MINE_FULL_FRESHNESS_BP = MINE_BASIS_POINTS_PER_UNIT;

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

export function reinforcePressureRecord(
  record: AreaMinePressureRecord,
  effectiveLayingValue: SafeInt,
  layingSourceId: string,
  campaignMonth: SafeInt,
  targetBelligerents: readonly string[],
): AreaMinePressureRecord {
  const addedPressure = computeAddedPressure(record.pressure, effectiveLayingValue);

  if (effectiveLayingValue <= 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "effectiveLayingValue",
      reason:
        "a zero or negative laying value means no laying (§4); reinforcement requires a positive value",
      value: effectiveLayingValue,
    });

  const newPressure: SafeInt = SafeInt.add(record.pressure, addedPressure);

  if (addedPressure < 0 || newPressure < MINE_PRESSURE_MIN || newPressure > MINE_PRESSURE_MAX)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "pressure",
      reason: "post-increase pressure must remain within 1..1_000_000 (§5)",
      value: { currentPressure: record.pressure, addedPressure, newPressure },
    });

  const olderPressure = BigInt(record.pressure);
  const oldFreshness = BigInt(record.freshnessBp);
  const added = BigInt(addedPressure);
  const newPressureBig = BigInt(newPressure);
  const freshnessNumerator = olderPressure * oldFreshness + added * BigInt(MINE_FULL_FRESHNESS_BP);
  const newFreshnessBp: number = Number(freshnessNumerator / newPressureBig);
  const newFreshnessSafe = SafeInt(newFreshnessBp);

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
