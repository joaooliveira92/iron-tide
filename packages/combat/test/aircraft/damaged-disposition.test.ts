// AC-20 (INC-6): Damaged aircraft disposition — 7 dispositions, cannibalization, no auto-clear.
import { describe, expect, it } from "vite-plus/test";
import {
  checkDispositionValidity,
  assertDispositionValidity,
  applyDispositionToSlot,
  type DispositionResult,
} from "../../src/aircraft/damaged-disposition.js";
import { DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED } from "../../src/aircraft/reasonCodes.js";
import { AIRCRAFT_DAMAGED_DISPOSITIONS } from "../../src/aircraft/constants.js";
import type { BasingSlot } from "../../src/aircraft/state.js";
import type { BluewaveError } from "@bluewave/contracts";

function damagedSlot(): BasingSlot {
  return {
    slotId: "base_a_m1_1917-01",
    hostId: "base_a",
    aircraftModelId: "m1",
    squadronId: "sq_1",
    condition: "DAMAGED_REPAIRABLE",
    allocatedAt: "1917-01",
  };
}

describe("AC-20: 7 damaged dispositions", () => {
  it("declares exactly the 7 canonical dispositions", () => {
    expect([...AIRCRAFT_DAMAGED_DISPOSITIONS]).toEqual([
      "REPAIR_LOCALLY",
      "AWAIT_REPAIR_CAPACITY",
      "TRANSFER_FOR_REPAIR",
      "WRITE_OFF",
      "CANNIBALIZE",
      "CAPTURED",
      "LOST",
    ]);
  });
});

function _isAllowedDisposition(
  r: DispositionResult,
): r is { allowed: true; removeFromInventory: boolean; createSpareParts: boolean } {
  return (r as { allowed: boolean }).allowed === true;
}

describe("disposition validity", () => {
  it("REPAIR_LOCALLY requires all resources", () => {
    const r = checkDispositionValidity({
      disposition: "REPAIR_LOCALLY",
      hasOperationalRepairCapacity: true,
      hasParts: true,
      hasPersonnel: true,
      hasPayment: true,
      hasTimeAvailable: true,
    });
    expect(r.allowed).toBe(true);
  });

  it("REPAIR_LOCALLY fails without repair capacity", () => {
    const r = checkDispositionValidity({
      disposition: "REPAIR_LOCALLY",
      hasOperationalRepairCapacity: false,
      hasParts: true,
      hasPersonnel: true,
      hasPayment: true,
      hasTimeAvailable: true,
    });
    expect(r.allowed).toBe(false);
  });

  it("CANNIBALIZE requires personnel and removes from inventory + creates spares", () => {
    const r = checkDispositionValidity({
      disposition: "CANNIBALIZE",
      hasOperationalRepairCapacity: false,
      hasParts: false,
      hasPersonnel: true,
      hasPayment: false,
      hasTimeAvailable: false,
    });
    expect(r.allowed).toBe(true);
    const dr = r as { allowed: true; removeFromInventory: boolean; createSpareParts: boolean };
    expect(dr.removeFromInventory).toBe(true);
    expect(dr.createSpareParts).toBe(true);
  });

  it("WRITE_OFF removes from inventory, no spare parts", () => {
    const r = checkDispositionValidity({
      disposition: "WRITE_OFF",
      hasOperationalRepairCapacity: false,
      hasParts: false,
      hasPersonnel: false,
      hasPayment: false,
      hasTimeAvailable: false,
    });
    expect(r.allowed).toBe(true);
    const dr = r as { allowed: true; removeFromInventory: boolean; createSpareParts: boolean };
    expect(dr.removeFromInventory).toBe(true);
    expect(dr.createSpareParts).toBe(false);
  });

  it("CAPTURED and LOST remove from inventory", () => {
    for (const d of ["CAPTURED", "LOST"] as const) {
      const r = checkDispositionValidity({
        disposition: d,
        hasOperationalRepairCapacity: false,
        hasParts: false,
        hasPersonnel: false,
        hasPayment: false,
        hasTimeAvailable: false,
      });
      expect(r.allowed).toBe(true);
      const dr = r as { allowed: true; removeFromInventory: boolean; createSpareParts: boolean };
      expect(dr.removeFromInventory).toBe(true);
      expect(dr.createSpareParts).toBe(false);
    }
  });
});

describe("applyDispositionToSlot", () => {
  it("REPAIR_LOCALLY changes condition to UNASSIGNED_OPERATIONAL", () => {
    const result = applyDispositionToSlot(damagedSlot(), "REPAIR_LOCALLY");
    expect(result.condition).toBe("UNASSIGNED_OPERATIONAL");
    expect(result.squadronId).toBe("sq_1");
  });

  it("WRITE_OFF changes condition and clears squadron", () => {
    const result = applyDispositionToSlot(damagedSlot(), "WRITE_OFF");
    expect(result.condition).toBe("WRITTEN_OFF");
    expect(result.squadronId).toBeNull();
  });

  it("CANNIBALIZE changes to WRITTEN_OFF and clears squadron", () => {
    const result = applyDispositionToSlot(damagedSlot(), "CANNIBALIZE");
    expect(result.condition).toBe("WRITTEN_OFF");
    expect(result.squadronId).toBeNull();
  });

  it("CAPTURED sets condition and clears squadron", () => {
    const result = applyDispositionToSlot(damagedSlot(), "CAPTURED");
    expect(result.condition).toBe("CAPTURED");
    expect(result.squadronId).toBeNull();
  });

  it("LOST sets condition and clears squadron", () => {
    const result = applyDispositionToSlot(damagedSlot(), "LOST");
    expect(result.condition).toBe("LOST");
    expect(result.squadronId).toBeNull();
  });
});

describe("assertDispositionValidity", () => {
  it("throws DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED when invalid", () => {
    let err: BluewaveError | undefined;
    try {
      assertDispositionValidity({
        disposition: "REPAIR_LOCALLY",
        hasOperationalRepairCapacity: false,
        hasParts: false,
        hasPersonnel: false,
        hasPayment: false,
        hasTimeAvailable: false,
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED);
  });
});
