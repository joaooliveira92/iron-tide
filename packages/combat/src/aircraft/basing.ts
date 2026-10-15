// DESIGN-43 §§20/32 basing model: capacities, slot allocation/deallocation, invariant.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { AIRCRAFT_BASING_CAPACITY_INSUFFICIENT } from "./reasonCodes.js";
import type { BasingSlot } from "./state.js";
import type { AircraftBasingClass, AircraftInventoryState } from "./constants.js";

export const AIRCRAFT_BASING_CAPACITIES_V1: Record<AircraftBasingClass, SafeInt> = {
  LAND_BASED: SafeInt(24),
  CARRIER_BASED: SafeInt(36),
  SEAPLANE_SUPPORTED: SafeInt(12),
  AIRSHIP_BASED: SafeInt(8),
  HELICOPTER_DECK_BASED: SafeInt(6),
  SPECIAL_EXPLICIT: SafeInt(12),
};

export function getBasingCapacity(basingClass: AircraftBasingClass): SafeInt {
  return AIRCRAFT_BASING_CAPACITIES_V1[basingClass];
}

export function computeUsedSlots(slots: readonly BasingSlot[]): SafeInt {
  let used = SafeInt.ZERO;
  for (const slot of slots) {
    if (slot.condition !== "WRITTEN_OFF" && slot.condition !== "LOST") {
      used = SafeInt.add(used, SafeInt.ONE);
    }
  }
  return used;
}

export function checkBasingCapacity(
  hostId: string,
  basingClass: AircraftBasingClass,
  currentSlots: readonly BasingSlot[],
  requestedSlots: SafeInt,
): boolean {
  const capacity = getBasingCapacity(basingClass);
  const used = computeUsedSlots(currentSlots);
  return SafeInt.sub(capacity, used) >= requestedSlots;
}

export function assertBasingCapacity(
  hostId: string,
  basingClass: AircraftBasingClass,
  currentSlots: readonly BasingSlot[],
  requestedSlots: SafeInt,
): void {
  if (!checkBasingCapacity(hostId, basingClass, currentSlots, requestedSlots)) {
    const capacity = getBasingCapacity(basingClass);
    const used = computeUsedSlots(currentSlots);
    throw new BluewaveError(AIRCRAFT_BASING_CAPACITY_INSUFFICIENT, {
      code: AIRCRAFT_BASING_CAPACITY_INSUFFICIENT,
      hostId,
      basingClass,
      capacity: Number(capacity),
      used: Number(used),
      requested: Number(requestedSlots),
    });
  }
}

export function allocateBasingSlot(
  hostId: string,
  aircraftModelId: string,
  squadronId: string | null,
  condition: AircraftInventoryState,
  currentMonth: string,
): BasingSlot {
  const slotId = `${hostId}_${aircraftModelId}_${currentMonth}`;
  return {
    slotId,
    hostId,
    aircraftModelId,
    squadronId,
    condition,
    allocatedAt: currentMonth,
  };
}

export function releaseBasingSlot(
  slot: BasingSlot,
  newCondition: AircraftInventoryState,
): BasingSlot {
  return { ...slot, condition: newCondition, squadronId: null };
}

export function removeBasingSlot(slot: BasingSlot): BasingSlot {
  return { ...slot, condition: "LOST", squadronId: null };
}
