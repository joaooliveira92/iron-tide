// DESIGN-43 §21 damaged aircraft disposition: 7 dispositions, cannibalization.
import { BluewaveError } from "@bluewave/contracts";
import { DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED } from "./reasonCodes.js";
import type { AircraftDamagedDisposition } from "./constants.js";
import type { BasingSlot } from "./state.js";

export interface DispositionInput {
  disposition: AircraftDamagedDisposition;
  hasOperationalRepairCapacity: boolean;
  hasParts: boolean;
  hasPersonnel: boolean;
  hasPayment: boolean;
  hasTimeAvailable: boolean;
}

export type DispositionResult =
  | { allowed: true; removeFromInventory: boolean; createSpareParts: boolean }
  | { allowed: false; reason: string };

export function checkDispositionValidity(input: DispositionInput): DispositionResult {
  const { disposition } = input;

  if (disposition === "REPAIR_LOCALLY") {
    if (!input.hasOperationalRepairCapacity) {
      return { allowed: false, reason: "NO_REPAIR_CAPACITY" };
    }
    if (!input.hasParts) {
      return { allowed: false, reason: "NO_PARTS" };
    }
    if (!input.hasPersonnel) {
      return { allowed: false, reason: "NO_PERSONNEL" };
    }
    if (!input.hasPayment) {
      return { allowed: false, reason: "NO_PAYMENT" };
    }
    if (!input.hasTimeAvailable) {
      return { allowed: false, reason: "NO_TIME_AVAILABLE" };
    }
    return { allowed: true, removeFromInventory: false, createSpareParts: false };
  }

  if (disposition === "AWAIT_REPAIR_CAPACITY") {
    return { allowed: true, removeFromInventory: false, createSpareParts: false };
  }

  if (disposition === "TRANSFER_FOR_REPAIR") {
    return { allowed: true, removeFromInventory: false, createSpareParts: false };
  }

  if (disposition === "WRITE_OFF") {
    return { allowed: true, removeFromInventory: true, createSpareParts: false };
  }

  if (disposition === "CANNIBALIZE") {
    if (!input.hasPersonnel) {
      return { allowed: false, reason: "NO_PERSONNEL" };
    }
    return { allowed: true, removeFromInventory: true, createSpareParts: true };
  }

  if (disposition === "CAPTURED" || disposition === "LOST") {
    return { allowed: true, removeFromInventory: true, createSpareParts: false };
  }

  throw new BluewaveError(DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED, {
    code: DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED,
    disposition,
    reason: "unknown disposition",
  });
}

export function assertDispositionValidity(input: DispositionInput): void {
  const result = checkDispositionValidity(input);
  if (!result.allowed) {
    throw new BluewaveError(DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED, {
      code: DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED,
      disposition: input.disposition,
      reason: result.reason,
    });
  }
}

export function applyDispositionToSlot(
  slot: BasingSlot,
  disposition: AircraftDamagedDisposition,
): BasingSlot {
  return {
    ...slot,
    condition:
      disposition === "REPAIR_LOCALLY"
        ? ("UNASSIGNED_OPERATIONAL" as const)
        : disposition === "AWAIT_REPAIR_CAPACITY"
          ? ("DAMAGED_AWAITING_CAPACITY" as const)
          : disposition === "WRITE_OFF"
            ? ("WRITTEN_OFF" as const)
            : disposition === "CANNIBALIZE"
              ? ("WRITTEN_OFF" as const)
              : disposition === "CAPTURED"
                ? ("CAPTURED" as const)
                : disposition === "LOST"
                  ? ("LOST" as const)
                  : disposition === "TRANSFER_FOR_REPAIR"
                    ? ("DAMAGED_AWAITING_CAPACITY" as const)
                    : slot.condition,
    squadronId:
      disposition === "CANNIBALIZE" ||
      disposition === "WRITE_OFF" ||
      disposition === "CAPTURED" ||
      disposition === "LOST"
        ? null
        : slot.squadronId,
  };
}
