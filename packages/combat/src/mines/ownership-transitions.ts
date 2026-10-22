import { BluewaveError } from "@bluewave/contracts";
import { MINE_TYPES, type MineType } from "./constants.js";
import { type AreaMinePressureRecord, withAreaMinePressureRecordHash } from "./pressure-record.js";
import {
  CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING,
  MINE_WARFARE_INVARIANT_FAILED,
} from "./reasonCodes.js";

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

export interface OwnershipTransitionContext {
  newLegalOwner?: string | null;
  newMilitaryController?: string | null;
  clearanceObligationParticipantId?: string;
  declaredDestroyEffect?: string;
  controlInfrastructureOperational: boolean;
}

export interface OwnershipTransitionResult {
  record: AreaMinePressureRecord;
  disposition: CloseMineControlDisposition;
  controlInfrastructureOperational: boolean;
  safeLanesDisclosed: boolean;
  clearanceObligationParticipantId: string | null;
  declaredDestroyEffect: string | null;
  controlledDefensiveApplied: boolean;
}

function invariant(code: string, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(code, { code, field, reason, value });
}

function isControlDefensive(mineTypeId: MineType): boolean {
  return mineTypeId === MINE_TYPES[3];
}

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

export function applyOwnershipTransition(
  record: AreaMinePressureRecord,
  disposition: CloseMineControlDisposition | null | undefined,
  context: OwnershipTransitionContext,
): OwnershipTransitionResult {
  const effective = resolveDispositionForRecord(record, disposition);
  const controlledDefensiveApplied = isControlDefensive(record.mineTypeId);

  let legalOwner = record.legalOwnerOfSourceFacilities;
  let militaryController = record.militaryControllerOfSourceFacilities;
  let controlInfrastructureOperational = context.controlInfrastructureOperational;
  let safeLanesDisclosed = false;
  let clearanceObligationParticipantId: string | null = null;
  let declaredDestroyEffect: string | null = null;

  switch (effective) {
    case "PRESERVE_ACTIVE":
      if (context.newLegalOwner !== undefined) legalOwner = context.newLegalOwner;
      if (context.newMilitaryController !== undefined)
        militaryController = context.newMilitaryController;
      break;
    case "TRANSFER_CONTROLLED_MINE_AUTHORITY":
      if (context.newMilitaryController !== undefined)
        militaryController = context.newMilitaryController;
      break;
    case "DEACTIVATE_CONTROLLED_MINES":
      controlInfrastructureOperational = false;
      break;
    case "DISCLOSE_SAFE_LANES":
      safeLanesDisclosed = true;
      break;
    case "ASSIGN_CLEARANCE_OBLIGATION":
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

export interface RecordsOwnershipTransitionContext extends OwnershipTransitionContext {
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
