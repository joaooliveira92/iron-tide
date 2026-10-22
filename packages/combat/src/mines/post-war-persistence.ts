import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_PRESSURE_MAX,
  MINE_PRESSURE_MIN,
  type AreaMinePressureRecord,
  withAreaMinePressureRecordHash,
} from "./pressure-record.js";
import { MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

export type PostWarRecordDisposition = "PERSISTS_ACTIVE";

export const POST_WAR_RECORD_DISPOSITION: readonly PostWarRecordDisposition[] = [
  "PERSISTS_ACTIVE",
] as const;

export interface PostWarAssessmentItem {
  record: AreaMinePressureRecord;
  disposition: PostWarRecordDisposition;
  preservedTargetBelligerents: readonly string[];
}

export interface PostWarAssessmentResult {
  records: readonly PostWarAssessmentItem[];
  warTerminated: boolean;
  newLayingRequiresSeparatePolicy: boolean;
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

export interface AdjustTargetSetTerm {
  kind: "ADJUST_TARGET_SET";
  targetBelligerents: readonly string[];
}
export interface DiscloseSafeLanesTerm {
  kind: "DISCLOSE_SAFE_LANES";
}
export interface AssignClearanceObligationTerm {
  kind: "ASSIGN_CLEARANCE_OBLIGATION";
  participantId: string;
}

export type PeaceSettlementTerm =
  | AdjustTargetSetTerm
  | DiscloseSafeLanesTerm
  | AssignClearanceObligationTerm;

export interface PeaceSettlementTermResult {
  record: AreaMinePressureRecord;
  termKind: PeaceSettlementTerm["kind"];
  targetBelligerents: readonly string[];
  safeLanesDisclosed: boolean;
  clearanceObligationAssigned: boolean;
  clearanceObligationParticipantId: string | null;
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
}

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
