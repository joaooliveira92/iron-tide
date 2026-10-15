// DESIGN-35 §27 mine-clearance completion (INC-7). A mine-pressure record is
// CLEARED when pressure reaches 0 after sweeping or decay (§27; zero pressure =
// absence of an active record, §1). Clearance MUST:
//
//   - close the active pressure record (return an explicit closed-state marker —
//     the active record becomes ABSENT, mirrored by isRecordCleared / a
//     ClearedMinefieldMarker);
//   - PRESERVE historical source and action records (never thrown away — the
//     closure result carries the record's sourceComposition, creation month, etc.
//     forward, matching §1's append-only posture);
//   - update visible knowledge according to source/reporting rules (a knowledge
//     assertion is fed forward to the calling participant);
//   - remove battle and route risk for THAT record from subsequent phases
//     (a `removedFromSubsequentRisk` flag — the record no longer appears in the
//     active set a subsequent battle/route phase consumes);
//   - emit MINEFIELD_CLEARED (returned in the result).
//
// Clearance of ONE laying participant's minefield MUST NOT clear another's:
// `clearRecordById` clears EXACTLY ONE record matching recordId (+ its laying
// participant) and leaves every other record untouched.
//
// ZERO-PRESSURE TRANSITIONAL-HASH SEAM (INC-4 coordinate): applySweptPressure /
// applyDecayedMonth produce a transitional zero-pressure AreaMinePressureRecord
// whose hash is computed via computeAreaPressureRecordHash (not the active
// withAreaMinePressureRecordHash). clearRecord ACCEPTS that same transitional
// shape (pressure === 0, hash already present) and CLOSES it; it never re-hashes
// with the active validator, so there is no serialization/hash conflict between
// the INC-4 seam and §27 closure.
//
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import type { MineType } from "./constants.js";
import type { AreaMinePressureRecord, OrderedSourceCompositionItem } from "./pressure-record.js";
import { MINEFIELD_CLEARED, MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

// §27 closure cause — clearance happens after sweeping or decay.
export type ClearanceCause = "SWEEPING" | "DECAY";

// The structural marker proving the active record was closed. It is NOT another
// `AreaMinePressureRecord` (zero pressure = absence, §1): it is the append-only
// history record that survives the active record's closure.
export interface ClearedMinefieldMarker {
  kind: "CLEARED_MINEFIELD";
  minePressureId: string;
  areaId: string;
  layingParticipantId: string;
  mineTypeId: MineType;
  /** Campaign month in which clearance finalized the record. */
  closedAtMonth: SafeInt;
  cause: ClearanceCause;
  /** Historical source composition, PRESERVED (§27/§1 append-only). */
  preservedSourceComposition: readonly OrderedSourceCompositionItem[];
  /** Historical creation month, PRESERVED. */
  preservedCreationMonth: SafeInt;
  /** Historical target-belligerent set, PRESERVED. */
  preservedTargetBelligerents: readonly string[];
}

export interface MineClearanceResult {
  /** The closure marker (active record closed); null only for a no-op on an already-cleared record. */
  closure: ClearedMinefieldMarker | null;
  /** True when this call actually closed an active record. */
  cleared: boolean;
  /** Cause of clearance. */
  cause: ClearanceCause;
  /** MINEFIELD_CLEARED emitted when a record was closed. */
  emittedCode: "MINEFIELD_CLEARED" | null;
  /** Whether subsequent battle/route phases must EXCLUDE this record (true when cleared). */
  removedFromSubsequentRisk: boolean;
  /** Knowledge update to feed the participant (an explicit assertion template the caller stores). */
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

// §27: a record is cleared when pressure === 0 (after sweeping or decay).
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

// AC-19: close a cleared (pressure === 0) AreaMinePressureRecord. Returns the
// closure marker (historical source/action records PRESERVED), emits
// MINEFIELD_CLEARED, flags removedFromSubsequentRisk, and feeds a knowledge
// update. NO record is deleted by this function — the active record is replaced
// by its append-only closure marker; the caller's store keeps history per §1.
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
  /** The record that was closed, if any. */
  closure: ClearedMinefieldMarker | null;
  /** The remaining (active) records — every record UNLESS it was the single cleared one. */
  remaining: readonly AreaMinePressureRecord[];
  /** The cleared record returned in closure form (null when none matched/clearable). */
  cleared: boolean;
  emittedCode: "MINEFIELD_CLEARED" | null;
  removedFromSubsequentRisk: boolean;
}

// AC-19: clear EXACTLY ONE record matching recordId AND the laying participant
// (participantPK). Leaves ALL other records untouched and marked as remaining.
// A record that is not pressure-0 (not yet cleared) failing the §27 precondition
// throws — we never silently skip or clear a non-cleared record. If NO record
// matches, throw (fail closed) rather than silently clearing nothing.
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
