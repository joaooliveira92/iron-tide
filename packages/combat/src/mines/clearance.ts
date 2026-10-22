import { BluewaveError, SafeInt } from "@bluewave/contracts";
import type { MineType } from "./constants.js";
import type { AreaMinePressureRecord, OrderedSourceCompositionItem } from "./pressure-record.js";
import { MINEFIELD_CLEARED, MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

export type ClearanceCause = "SWEEPING" | "DECAY";

export interface ClearedMinefieldMarker {
  kind: "CLEARED_MINEFIELD";
  minePressureId: string;
  areaId: string;
  layingParticipantId: string;
  mineTypeId: MineType;
  closedAtMonth: SafeInt;
  cause: ClearanceCause;
  preservedSourceComposition: readonly OrderedSourceCompositionItem[];
  preservedCreationMonth: SafeInt;
  preservedTargetBelligerents: readonly string[];
}

export interface MineClearanceResult {
  closure: ClearedMinefieldMarker | null;
  cleared: boolean;
  cause: ClearanceCause;
  emittedCode: "MINEFIELD_CLEARED" | null;
  removedFromSubsequentRisk: boolean;
  knowledgeUpdate: {
    areaId: string;
    participantId: string;
    knownClearedLanes: readonly string[];
    lastObservedOrSweptMonth: SafeInt;
    mineType: MineType;
  } | null;
}

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
    code: MINE_WARFARE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function isRecordCleared(record: AreaMinePressureRecord): boolean {
  if (!SafeInt.isSafeInt(record.pressure)) {
    invariant("pressure", record.pressure, "pressure must be a safe integer");
  }
  return record.pressure === SafeInt.ZERO;
}

function assertClearable(record: AreaMinePressureRecord, cause: ClearanceCause): void {
  if (cause !== "SWEEPING" && cause !== "DECAY")
    invariant("cause", cause, "clearance cause must be SWEEPING or DECAY (§27)");
  if (!SafeInt.isSafeInt(record.pressure))
    invariant("pressure", record.pressure, "pressure must be a safe integer");
  if (record.pressure !== SafeInt.ZERO) {
    throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
      code: MINE_WARFARE_INVARIANT_FAILED,
      field: "pressure",
      reason:
        "Mine-clearance completion requires pressure === 0 (cleared after sweeping or decay, §27); a positive-pressure record is not clearable here",
      value: { minePressureId: record.minePressureId, pressure: record.pressure },
    });
  }
}

export function clearRecord(
  record: AreaMinePressureRecord,
  cause: ClearanceCause,
  closedAtMonth: SafeInt,
): MineClearanceResult {
  if (!SafeInt.isSafeInt(closedAtMonth))
    invariant("closedAtMonth", closedAtMonth, "closedAtMonth must be a safe integer");
  assertClearable(record, cause);

  const closure: ClearedMinefieldMarker = {
    kind: "CLEARED_MINEFIELD",
    minePressureId: record.minePressureId,
    areaId: record.areaId,
    layingParticipantId: record.layingParticipantId,
    mineTypeId: record.mineTypeId,
    closedAtMonth,
    cause,
    preservedSourceComposition: [...record.sourceComposition],
    preservedCreationMonth: record.creationMonth,
    preservedTargetBelligerents: [...record.targetBelligerents],
  };

  return {
    closure,
    cleared: true,
    cause,
    emittedCode: MINEFIELD_CLEARED,
    removedFromSubsequentRisk: true,
    knowledgeUpdate: {
      areaId: record.areaId,
      participantId: record.layingParticipantId,
      knownClearedLanes: [],
      lastObservedOrSweptMonth: closedAtMonth,
      mineType: record.mineTypeId,
    },
  };
}

export interface ClearByIdResult {
  closure: ClearedMinefieldMarker | null;
  remaining: readonly AreaMinePressureRecord[];
  cleared: boolean;
  emittedCode: "MINEFIELD_CLEARED" | null;
  removedFromSubsequentRisk: boolean;
}

export function clearRecordById(
  records: readonly AreaMinePressureRecord[],
  recordId: string,
  participantPK: string,
  cause: ClearanceCause,
  closedAtMonth: SafeInt,
): ClearByIdResult {
  if (typeof recordId !== "string" || recordId.length === 0)
    invariant("recordId", recordId, "record id must be a non-empty string");
  if (typeof participantPK !== "string" || participantPK.length === 0)
    invariant("participantPK", participantPK, "participant id must be a non-empty string");
  if (!SafeInt.isSafeInt(closedAtMonth))
    invariant("closedAtMonth", closedAtMonth, "closedAtMonth must be a safe integer");

  const match = records.find(
    (r) => r.minePressureId === recordId && r.layingParticipantId === participantPK,
  );
  if (!match) {
    throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
      code: MINE_WARFARE_INVARIANT_FAILED,
      field: "recordId|participantPK",
      reason:
        "clearRecordById matched no record — clearing one participant's minefield never touches another's (§27)",
      value: { recordId, participantPK },
    });
  }
  const cleared = clearRecord(match, cause, closedAtMonth);
  const remaining = records.filter(
    (r) => !(r.minePressureId === recordId && r.layingParticipantId === participantPK),
  );
  return {
    closure: cleared.closure,
    remaining,
    cleared: true,
    emittedCode: MINEFIELD_CLEARED,
    removedFromSubsequentRisk: true,
  };
}
