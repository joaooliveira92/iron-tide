import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  getBasingCapacity,
  computeUsedSlots,
  checkBasingCapacity,
  assertBasingCapacity,
  allocateBasingSlot,
  releaseBasingSlot,
  removeBasingSlot,
} from "@bluewave/combat/aircraft";
import { AIRCRAFT_BASING_CAPACITY_INSUFFICIENT } from "@bluewave/combat/aircraft";
import { AIRCRAFT_BASING_CLASSES } from "@bluewave/combat/aircraft";
import type { BasingSlot } from "@bluewave/combat/aircraft";
import type { BluewaveError } from "@bluewave/contracts";

describe("AC-21: basing classes enum", () => {
  it("declares exactly the 6 canonical basing classes", () => {
    expect([...AIRCRAFT_BASING_CLASSES]).toEqual([
      "LAND_BASED",
      "CARRIER_BASED",
      "SEAPLANE_SUPPORTED",
      "AIRSHIP_BASED",
      "HELICOPTER_DECK_BASED",
      "SPECIAL_EXPLICIT",
    ]);
  });

  it("has positive default capacities for all 6 classes", () => {
    for (const cls of AIRCRAFT_BASING_CLASSES) {
      expect(Number(getBasingCapacity(cls))).toBeGreaterThan(0);
    }
  });
});

describe("AC-19: basing capacity invariant", () => {
  it("computes used slots excluding WRITTEN_OFF and LOST", () => {
    const slots: BasingSlot[] = [
      {
        slotId: "s1",
        hostId: "base_a",
        aircraftModelId: "m1",
        squadronId: "sq1",
        condition: "UNASSIGNED_OPERATIONAL",
        allocatedAt: "1917-01",
      },
      {
        slotId: "s2",
        hostId: "base_a",
        aircraftModelId: "m2",
        squadronId: null,
        condition: "WRITTEN_OFF",
        allocatedAt: "1917-01",
      },
      {
        slotId: "s3",
        hostId: "base_a",
        aircraftModelId: "m3",
        squadronId: "sq1",
        condition: "ASSIGNED_OPERATIONAL",
        allocatedAt: "1917-01",
      },
    ];
    expect(Number(computeUsedSlots(slots))).toBe(2);
  });

  it("checks capacity correctly", () => {
    const slots: BasingSlot[] = [
      {
        slotId: "s1",
        hostId: "base_a",
        aircraftModelId: "m1",
        squadronId: "sq1",
        condition: "ASSIGNED_OPERATIONAL",
        allocatedAt: "1917-01",
      },
    ];
    expect(checkBasingCapacity("base_a", "LAND_BASED", slots, SafeInt(1))).toBe(true);
    expect(checkBasingCapacity("base_a", "LAND_BASED", slots, SafeInt(24))).toBe(false);
  });

  it("assertBasingCapacity throws on insufficient capacity", () => {
    const slots: BasingSlot[] = [
      {
        slotId: "s1",
        hostId: "base_a",
        aircraftModelId: "m1",
        squadronId: "sq1",
        condition: "ASSIGNED_OPERATIONAL",
        allocatedAt: "1917-01",
      },
    ];
    let err: BluewaveError | undefined;
    try {
      assertBasingCapacity("base_a", "LAND_BASED", slots, SafeInt(24));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(AIRCRAFT_BASING_CAPACITY_INSUFFICIENT);
  });
});

describe("basing slot operations", () => {
  it("allocateBasingSlot creates a slot with correct condition", () => {
    const slot = allocateBasingSlot(
      "base_brest",
      "spad_s_xiii",
      "sq_1",
      "ASSIGNED_OPERATIONAL",
      "1917-01",
    );
    expect(slot.hostId).toBe("base_brest");
    expect(slot.aircraftModelId).toBe("spad_s_xiii");
    expect(slot.squadronId).toBe("sq_1");
    expect(slot.condition).toBe("ASSIGNED_OPERATIONAL");
    expect(slot.allocatedAt).toBe("1917-01");
  });

  it("releaseBasingSlot clears squadron and sets new condition", () => {
    const slot = allocateBasingSlot(
      "base_brest",
      "spad_s_xiii",
      "sq_1",
      "ASSIGNED_OPERATIONAL",
      "1917-01",
    );
    const released = releaseBasingSlot(slot, "UNASSIGNED_OPERATIONAL");
    expect(released.condition).toBe("UNASSIGNED_OPERATIONAL");
    expect(released.squadronId).toBeNull();
  });

  it("removeBasingSlot sets condition to LOST and clears squadron", () => {
    const slot = allocateBasingSlot(
      "base_brest",
      "spad_s_xiii",
      "sq_1",
      "ASSIGNED_OPERATIONAL",
      "1917-01",
    );
    const removed = removeBasingSlot(slot);
    expect(removed.condition).toBe("LOST");
    expect(removed.squadronId).toBeNull();
  });
});
