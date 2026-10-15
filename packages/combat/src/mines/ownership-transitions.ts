// DESIGN-35 §23 ownership and control changes (INC-7). Legal ownership or
// military control change of an area / possession / base / coastal installation
// MUST NOT delete or neutralize mine pressure automatically. A transition MUST
// explicitly declare EXACTLY ONE of six closed dispositions per affected
// mine-pressure record; uncontrolled contact/magnetic/acoustic/submarine-laid
// mines remain active until decay or clearance by default; a MISSING disposition
// for a controlled-defensive mine MUST fail with
// CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING.
//
// THE §23 HARD INVARIANT: in ALL six dispositions the authoritative `pressure`
// field is UNCHANGED — only ownership/control/knowledge/meta fields change.
//
// CONTROL-INFRASTRUCTURE-OPERATIONAL ("controlInfrastructureOperational" used by
// §21 decay): the AreaMinePressureRecord schema does NOT carry this state (and we
// must NOT expand the record hash-envelope schema — goldens stay untouched), so it
// is carried as part of the transition CONTEXT (the caller's current belief of
// whether the source-facility control infrastructure is operational) and surfaced
// as a RESULT FLAG. The decay function (§21) takes it as an input. This keeps the
// pure record surface identical while wiring decay's infra-gated multiplier.
//
// Pure/deterministic: no I/O/clock/random; pressure is never mutated.
import { BluewaveError } from "@bluewave/contracts";
import { MINE_TYPES, type MineType } from "./constants.js";
import { type AreaMinePressureRecord, withAreaMinePressureRecordHash } from "./pressure-record.js";
import {
  CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING,
  MINE_WARFARE_INVARIANT_FAILED,
} from "./reasonCodes.js";

// The SIX closed dispositions of §23 — a fixed discriminated set, NEVER an open
// string, so a missing/invalid disposition is a compile-time AND runtime
// (CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING) failure.
export type CloseMineControlDisposition =
  | "PRESERVE_ACTIVE"
  | "TRANSFER_CONTROLLED_MINE_AUTHORITY"
  | "DEACTIVATE_CONTROLLED_MINES"
  | "DISCLOSE_SAFE_LANES"
  | "ASSIGN_CLEARANCE_OBLIGATION"
  | "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT";

export const CLOSE_MINE_CONTROL_DISPOSITIONS: readonly CloseMineControlDisposition[] = [
  "PRESERVE_ACTIVE",
  "TRANSFER_CONTROLLED_MINE_AUTHORITY",
  "DEACTIVATE_CONTROLLED_MINES",
  "DISCLOSE_SAFE_LANES",
  "ASSIGN_CLEARANCE_OBLIGATION",
  "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT",
] as const;

export function isClosedMineControlDisposition(v: unknown): v is CloseMineControlDisposition {
  return (CLOSE_MINE_CONTROL_DISPOSITIONS as readonly string[]).includes(v as string);
}

// Caller-supplied context for a transition. controlInfrastructureOperational is
// the caller's current belief of the source-facilities control-infra state (§21's
// infra-gated decay input) — carried through the transition, never stored on the
// pressure record (schema-surface invariant).
export interface OwnershipTransitionContext {
  /** New legal owner of the source facilities (PRESERVE_ACTIVE / transfer). */
  newLegalOwner?: string | null;
  /** New military controller / authority (TRANSFER_CONTROLLED_MINE_AUTHORITY / PRESERVE_ACTIVE). */
  newMilitaryController?: string | null;
  /** Participant assigned the clearance obligation (ASSIGN_CLEARANCE_OBLIGATION). */
  clearanceObligationParticipantId?: string;
  /** DECLARED effect of destroying control infrastructure (DESTROY_...): REQUIRED. */
  declaredDestroyEffect?: string;
  /**
   * Current operational state of the source-facilities control infrastructure
   * (§21 input). If a disposition deactivates/or destroys it, the result flag
   * flips to false; otherwise it is passed through unchanged.
   */
  controlInfrastructureOperational: boolean;
}

export interface OwnershipTransitionResult {
  /** The record with ownership/control/meta fields updated; pressure UNCHANGED. */
  record: AreaMinePressureRecord;
  /** The disposition actually declared for this record. */
  disposition: CloseMineControlDisposition;
  /** Post-transition control-infrastructure-operational belief (§21 decay input). */
  controlInfrastructureOperational: boolean;
  /** True when the transition disclosed known safe lanes. */
  safeLanesDisclosed: boolean;
  /** Participant assigned a clearance obligation, if any. */
  clearanceObligationParticipantId: string | null;
  /** Declared destroy effect, when the disposition is DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT. */
  declaredDestroyEffect: string | null;
  /** True when this disposition applies to CONTROLLED_DEFENSIVE mines. */
  controlledDefensiveApplied: boolean;
}

function invariant(code: string, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(code, { code, field, reason, value });
}

function isControlDefensive(mineTypeId: MineType): boolean {
  return mineTypeId === MINE_TYPES[3]; // CONTROLLED_DEFENSIVE
}

// AC-17: resolve the effective disposition for a record. A null/absent/missing
// disposition for a CONTROLLED_DEFENSIVE record throws
// CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING; for uncontrolled types it
// defaults to PRESERVE_ACTIVE (they remain active until decay/clearance, §23).
export function resolveDispositionForRecord(
  record: AreaMinePressureRecord,
  disposition: CloseMineControlDisposition | null | undefined,
): CloseMineControlDisposition {
  if (
    disposition !== null &&
    disposition !== undefined &&
    isClosedMineControlDisposition(disposition)
  ) {
    return disposition;
  }
  if (isControlDefensive(record.mineTypeId)) {
    throw new BluewaveError(CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING, {
      code: CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING,
      minePressureId: record.minePressureId,
      mineTypeId: record.mineTypeId,
      reason:
        "ownership/control change reached a controlled-defensive mine without a declared §23 disposition — one of the six closed dispositions is required",
    });
  }
  return "PRESERVE_ACTIVE";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

// AC-17: apply an ownership/control-change disposition to ONE mine-pressure
// record. Returns the updated record + the disposition effect flags. THE PRESSURE
// FIELD IS ALWAYS UNCHANGED (§23 hard invariant). Ownership/control/meta field
// updates per disposition:
export function applyOwnershipTransition(
  record: AreaMinePressureRecord,
  disposition: CloseMineControlDisposition | null | undefined,
  context: OwnershipTransitionContext,
): OwnershipTransitionResult {
  const effective = resolveDispositionForRecord(record, disposition);
  const controlledDefensiveApplied = isControlDefensive(record.mineTypeId);

  // §23 hard invariant: pressure NEVER changes across any disposition — the
  // pressure field is deliberately re-set to the IDENTICAL value below.
  let legalOwner = record.legalOwnerOfSourceFacilities;
  let militaryController = record.militaryControllerOfSourceFacilities;
  let controlInfrastructureOperational = context.controlInfrastructureOperational;
  let safeLanesDisclosed = false;
  let clearanceObligationParticipantId: string | null = null;
  let declaredDestroyEffect: string | null = null;

  switch (effective) {
    case "PRESERVE_ACTIVE":
      // §23: pressure persists; ownership/controller updated to the new owner.
      if (context.newLegalOwner !== undefined) legalOwner = context.newLegalOwner;
      if (context.newMilitaryController !== undefined)
        militaryController = context.newMilitaryController;
      break;
    case "TRANSFER_CONTROLLED_MINE_AUTHORITY":
      // §23: controller changes to the new authority (pressure persists).
      if (context.newMilitaryController !== undefined)
        militaryController = context.newMilitaryController;
      break;
    case "DEACTIVATE_CONTROLLED_MINES":
      // §23: only controlled-defensive mines; mark control infrastructure
      // inactive; pressure PRESERVED; only the controlled flag is cleared.
      controlInfrastructureOperational = false;
      break;
    case "DISCLOSE_SAFE_LANES":
      // §23: marks known lanes disclosed (knowledge/meta field); pressure persists.
      safeLanesDisclosed = true;
      break;
    case "ASSIGN_CLEARANCE_OBLIGATION":
      // §23: records an obligation on the assigned participant; pressure persists.
      if (!isNonEmptyString(context.clearanceObligationParticipantId))
        invariant(
          MINE_WARFARE_INVARIANT_FAILED,
          "clearanceObligationParticipantId",
          context.clearanceObligationParticipantId,
          "ASSIGN_CLEARANCE_OBLIGATION requires a non-empty assigned participant id (§23)",
        );
      clearanceObligationParticipantId = context.clearanceObligationParticipantId;
      break;
    case "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT":
      // §23: REQUIRES a declared effect (e.g. physical destruction -> controlled
      // mines lose operational control; pressure persists but may flip to
      // uncontrolled). We set the declared effect + flip control-infra to
      // non-operational; the military controller is not auto-immutably deleted
      // (the declared effect names the consequence).
      if (!isNonEmptyString(context.declaredDestroyEffect))
        invariant(
          MINE_WARFARE_INVARIANT_FAILED,
          "declaredDestroyEffect",
          context.declaredDestroyEffect,
          "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT requires a declared effect (§23)",
        );
      declaredDestroyEffect = context.declaredDestroyEffect;
      controlInfrastructureOperational = false;
      break;
    default: {
      const _exhaustive: never = effective;
      void _exhaustive;
      invariant(
        MINE_WARFARE_INVARIANT_FAILED,
        "disposition",
        effective,
        "unreachable: a closed disposition union member not handled (§23)",
      );
    }
  }

  // §23 hard invariant: pressure NEVER changes across any disposition. The
  // ownership/control fields may change; the record hash is recomputed over the
  // changed surface so verifyAreaMinePressureRecordHash stays consistent.
  const updated: AreaMinePressureRecord = withAreaMinePressureRecordHash({
    ...record,
    pressure: record.pressure,
    legalOwnerOfSourceFacilities: legalOwner,
    militaryControllerOfSourceFacilities: militaryController,
  });

  return {
    record: updated,
    disposition: effective,
    controlInfrastructureOperational,
    safeLanesDisclosed,
    clearanceObligationParticipantId,
    declaredDestroyEffect,
    controlledDefensiveApplied,
  };
}

// AC-17: convenience — apply a transition across a SET of records, each with its
// own disposition (per-record dispositions; §23 "one disposition per affected
// record"). A missing disposition for any controlled-defensive record throws
// CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING; pressure never changes.
export interface RecordsOwnershipTransitionContext extends OwnershipTransitionContext {
  /** Per-record dispositions (keyed by minePressureId). Absent key = PRESERVE_ACTIVE by default (uncontrolled) / throw (controlled-defensive). */
  dispositionsByRecordId?: Readonly<Record<string, CloseMineControlDisposition>>;
}

export function applyOwnershipTransitionToRecords(
  records: readonly AreaMinePressureRecord[],
  dispositionsByRecordId: Readonly<Record<string, CloseMineControlDisposition>>,
  context: OwnershipTransitionContext,
): OwnershipTransitionResult[] {
  const results: OwnershipTransitionResult[] = [];
  for (const record of records) {
    results.push(
      applyOwnershipTransition(record, dispositionsByRecordId[record.minePressureId], context),
    );
  }
  return results;
}
