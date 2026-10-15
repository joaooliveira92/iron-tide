// DESIGN-35 §22 post-war persistence (INC-7). War termination MUST NOT remove
// mine pressure automatically: target-belligerent sets are preserved historically,
// minefields remain active hazards, decay continues monthly, clearance missions
// remain available, and NEW laying requires a separate legal policy. This module
// models the post-war disposition as DATA — an idempotent bookkeeping disposition
// — and never fabricates clearance or deletes/zeroes pressure.
//
// A peace settlement MAY alter target sets, access lanes, disclosure, or clearance
// obligations ONLY through typed terms (§22). The typed-terms union is CLOSED;
// an unknown/absent term FAILS CLOSED (throw), never a silent no-op.
//
// Pure/deterministic: no I/O/clock/random; pressure is never mutated by any
// function in this module.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_PRESSURE_MAX,
  MINE_PRESSURE_MIN,
  type AreaMinePressureRecord,
  withAreaMinePressureRecordHash,
} from "./pressure-record.js";
import { MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

// The one and only post-war disposition modelled for mine-pressure records. War
// termination leaves every active record computing through decay/clearance but
// does NOT change the record itself; PERSISTS_ACTIVE is the idempotent
// bookkeeping disposition (§22: "minefields remain active hazards"). There is NO
// auto-clearance disposition — clearance is a separate explicit §27 action.
export type PostWarRecordDisposition = "PERSISTS_ACTIVE";

export const POST_WAR_RECORD_DISPOSITION: readonly PostWarRecordDisposition[] = [
  "PERSISTS_ACTIVE",
] as const;

// AC-16: the disposition a record receives when assessed after war termination.
export interface PostWarAssessmentItem {
  record: AreaMinePressureRecord;
  /** The record's post-war disposition — always PERSISTS_ACTIVE (§22). */
  disposition: PostWarRecordDisposition;
  /** The original (historically preserved) target-belligerent set, unchanged. */
  preservedTargetBelligerents: readonly string[];
}

export interface PostWarAssessmentResult {
  /** The unchanged active records, each with its persisted disposition. */
  records: readonly PostWarAssessmentItem[];
  /** True when the caller declared war terminated. */
  warTerminated: boolean;
  /** True: new laying requires a separate legal policy (§22) — never granted here. */
  newLayingRequiresSeparatePolicy: boolean;
  /** Note string documenting the §22 persistence posture (data, not a mechanic). */
  note: string;
}

function assertActiveRecord(record: AreaMinePressureRecord): void {
  if (
    !SafeInt.isSafeInt(record.pressure) ||
    record.pressure < MINE_PRESSURE_MIN ||
    record.pressure > MINE_PRESSURE_MAX
  ) {
    throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
      code: MINE_WARFARE_INVARIANT_FAILED,
      reason: "post-war persistence assessment requires an active mine-pressure record",
      value: { minePressureId: record.minePressureId, pressure: record.pressure },
    });
  }
}

// AC-16: pure assessment. When warTerminated=true it returns the UNCHANGED active
// records + a note that they persist; it MUST NOT delete or zero pressure. When
// warTerminated=false the caller is simply reporting an in-war state — records still
// pass through unchanged (persistence is irrelevant but never harmful). Deterministic.
export function assessPostWarDisposition(
  records: readonly AreaMinePressureRecord[],
  warTerminated: boolean,
): PostWarAssessmentResult {
  const items: PostWarAssessmentItem[] = [];
  for (const record of records) {
    assertActiveRecord(record);
    items.push({
      record,
      disposition: "PERSISTS_ACTIVE",
      preservedTargetBelligerents: [...record.targetBelligerents],
    });
  }
  return {
    records: items,
    warTerminated,
    newLayingRequiresSeparatePolicy: warTerminated,
    note: warTerminated
      ? "War termination does not remove mine pressure: records PERSIST active, target sets are preserved historically, decay continues monthly, clearance remains available, and new laying requires a separate legal policy (§22)."
      : "War not terminated — post-war persistence assessment is a no-op.",
  };
}

// AC-16: a pure validator/assessor that asserts the §22 hard invariant — a post-war
// disposition can NEVER remove pressure. Returns `true` alignment when every active
// record persists; throws the canonical persistence invariant otherwise. Kept as a
// thin, documented guard so callers cannot accidentally clear/delete a legacy record.
export function assertPostWarPersistence(
  records: readonly AreaMinePressureRecord[],
  warTerminated: boolean,
): PostWarAssessmentResult {
  const result = assessPostWarDisposition(records, warTerminated);
  for (const item of result.records) {
    if (item.record.pressure < MINE_PRESSURE_MIN || item.record.pressure > MINE_PRESSURE_MAX) {
      throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
        code: MINE_WARFARE_INVARIANT_FAILED,
        reason: "post-war persistence invariant: no disposition may remove mine pressure (§22)",
        value: { minePressureId: item.record.minePressureId, pressure: item.record.pressure },
      });
    }
  }
  return result;
}

// ---- §22 typed peace-settlement terms (CLOSED union) ----

// ADJUST_TARGET_SET: a settlement MAY narrow/change which belligerents a record
// targets, via an explicit typed term. Replaced ordered target set (must stay
// non-empty, matching §1's target-belligerent invariant).
export interface AdjustTargetSetTerm {
  kind: "ADJUST_TARGET_SET";
  targetBelligerents: readonly string[];
}
// DISCLOSE_SAFE_LANES: marks known safe lanes disclosed (knowledge/meta only —
// this module does not own the knowledge store; the term is a data marker a
// settlement can record).
export interface DiscloseSafeLanesTerm {
  kind: "DISCLOSE_SAFE_LANES";
}
// ASSIGN_CLEARANCE_OBLIGATION: a settlement assigns an explicit clearance
// obligation to a participant.
export interface AssignClearanceObligationTerm {
  kind: "ASSIGN_CLEARANCE_OBLIGATION";
  participantId: string;
}

// The complete closed union of supported typed peace-settlement terms (§22).
// A settlement altering target sets / lanes / disclosure / clearance can only
// do so through one of these shapes; ANY other/unknown/absent term is rejected
// fail-closed (below).
export type PeaceSettlementTerm =
  | AdjustTargetSetTerm
  | DiscloseSafeLanesTerm
  | AssignClearanceObligationTerm;

export interface PeaceSettlementTermResult {
  record: AreaMinePressureRecord;
  termKind: PeaceSettlementTerm["kind"];
  /** Adjusted target set after the term (unchanged unless ADJUST_TARGET_SET). */
  targetBelligerents: readonly string[];
  /** True when the term disclosed safe lanes. */
  safeLanesDisclosed: boolean;
  /** True when the term assigned an explicit clearance obligation. */
  clearanceObligationAssigned: boolean;
  /** The participant an obligation was assigned to, if any. */
  clearanceObligationParticipantId: string | null;
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
}

// AC-16: apply a typed peace-settlement term to a mine-pressure record. Pressure
// is NEVER altered (the §22 hard invariant). Only target-set (ordered), safe-lane
// disclosure, or clearance-obligation fields may change — all OUR side fields;
// the record's authoritative pressure/source/type identity is untouched.
// An UNKNOWN or ABSENT term throws fail-closed (never a silent no-op).
export function applyPeaceSettlementTerms(
  record: AreaMinePressureRecord,
  terms: readonly PeaceSettlementTerm[],
): PeaceSettlementTermResult[] {
  const results: PeaceSettlementTermResult[] = [];
  let working: AreaMinePressureRecord = record;
  for (const term of terms) {
    if (term === null || term === undefined || typeof term !== "object") {
      throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
        code: MINE_WARFARE_INVARIANT_FAILED,
        reason:
          "peace settlement term is not a typed term — §22 FAILS CLOSED on an absent/invalid term",
        value: term,
      });
    }
    const kind = (term as { kind?: unknown }).kind;
    if (kind === "ADJUST_TARGET_SET") {
      const t = term as AdjustTargetSetTerm;
      if (!isStringArray(t.targetBelligerents) || t.targetBelligerents.length === 0) {
        throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
          code: MINE_WARFARE_INVARIANT_FAILED,
          reason: "ADJUST_TARGET_SET requires a non-empty ordered target-belligerent set (§22)",
          value: t.targetBelligerents,
        });
      }
      // Target-set change is a record-surface mutation (like every other
      // authoritative mutation): the record hash is recomputed over the changed
      // surface so verifyAreaMinePressureRecordHash stays consistent.
      const updated: AreaMinePressureRecord = withAreaMinePressureRecordHash({
        ...working,
        targetBelligerents: [...t.targetBelligerents],
      });
      working = updated;
      results.push({
        record: updated,
        termKind: "ADJUST_TARGET_SET",
        targetBelligerents: [...t.targetBelligerents],
        safeLanesDisclosed: false,
        clearanceObligationAssigned: false,
        clearanceObligationParticipantId: null,
      });
    } else if (kind === "DISCLOSE_SAFE_LANES") {
      results.push({
        record: working,
        termKind: "DISCLOSE_SAFE_LANES",
        targetBelligerents: [...working.targetBelligerents],
        safeLanesDisclosed: true,
        clearanceObligationAssigned: false,
        clearanceObligationParticipantId: null,
      });
    } else if (kind === "ASSIGN_CLEARANCE_OBLIGATION") {
      const t = term as AssignClearanceObligationTerm;
      if (typeof t.participantId !== "string" || t.participantId.length === 0) {
        throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
          code: MINE_WARFARE_INVARIANT_FAILED,
          reason: "ASSIGN_CLEARANCE_OBLIGATION requires a non-empty participant id (§22)",
          value: t.participantId,
        });
      }
      results.push({
        record: working,
        termKind: "ASSIGN_CLEARANCE_OBLIGATION",
        targetBelligerents: [...working.targetBelligerents],
        safeLanesDisclosed: false,
        clearanceObligationAssigned: true,
        clearanceObligationParticipantId: t.participantId,
      });
    } else {
      // Reject an unsupported/unknown/absent typed term — fail closed (§22).
      throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
        code: MINE_WARFARE_INVARIANT_FAILED,
        reason:
          "unsupported peace-settlement term — §22 only allows typed terms (ADJUST_TARGET_SET, DISCLOSE_SAFE_LANES, ASSIGN_CLEARANCE_OBLIGATION); FAILS CLOSED",
        value: kind,
      });
    }
  }
  return results;
}
