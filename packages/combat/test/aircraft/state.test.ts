// AC-3 (INC-2): Aircraft state under NationState. AC-4 (INC-2): inventory counts
// per model+condition, 9 inventory states, state exclusivity invariant.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  type AircraftNationState,
  type AircraftInventoryRecord,
  type BasingSlot,
  type SquadronState,
  withAircraftInventoryRecordHash,
  verifyAircraftInventoryRecordHash,
  AIRCRAFT_INVENTORY_STATES,
} from "../../src/aircraft/index.js";

describe("AC-3: AircraftNationState structure", () => {
  it("can construct a valid AircraftNationState with all fields", () => {
    const state: AircraftNationState = {
      models: {},
      inventory: {},
      developmentProjects: [],
      proposals: [],
      privateProposals: [],
      squadrons: [],
      basingAllocations: [],
      rulesetVersion: "aircraft_ruleset_v1",
      stateHash: "a".repeat(64),
    };
    expect(state.models).toBeDefined();
    expect(state.inventory).toBeDefined();
    expect(state.developmentProjects).toEqual([]);
    expect(state.squadrons).toEqual([]);
    expect(state.rulesetVersion).toBe("aircraft_ruleset_v1");
    expect(state.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("AC-4: 9 canonical inventory states", () => {
  it("declares exactly the 9 states per §13", () => {
    expect([...AIRCRAFT_INVENTORY_STATES]).toEqual([
      "UNASSIGNED_OPERATIONAL",
      "ASSIGNED_OPERATIONAL",
      "DAMAGED_REPAIRABLE",
      "DAMAGED_AWAITING_CAPACITY",
      "UNDER_REPAIR",
      "RESERVED_FOR_REEQUIPMENT",
      "WRITTEN_OFF",
      "CAPTURED",
      "LOST",
    ]);
  });
});

describe("AC-4: inventory count invariants", () => {
  it("tracks counts per model+condition as SafeInt", () => {
    const inventory: Record<string, Record<string, SafeInt>> = {
      spad_s_xiii_1917: {
        UNASSIGNED_OPERATIONAL: SafeInt(12),
        ASSIGNED_OPERATIONAL: SafeInt(24),
        DAMAGED_REPAIRABLE: SafeInt(2),
        WRITTEN_OFF: SafeInt(1),
      },
    };
    expect(Number(inventory["spad_s_xiii_1917"].UNASSIGNED_OPERATIONAL)).toBe(12);
    expect(Number(inventory["spad_s_xiii_1917"].ASSIGNED_OPERATIONAL)).toBe(24);
  });

  it("AircraftInventoryRecord carries a deterministic hash", () => {
    const record: AircraftInventoryRecord = {
      modelId: "spad_s_xiii_1917",
      conditionCounts: {
        UNASSIGNED_OPERATIONAL: SafeInt(12),
        ASSIGNED_OPERATIONAL: SafeInt(24),
        DAMAGED_REPAIRABLE: SafeInt(0),
        DAMAGED_AWAITING_CAPACITY: SafeInt(0),
        UNDER_REPAIR: SafeInt(0),
        RESERVED_FOR_REEQUIPMENT: SafeInt(0),
        WRITTEN_OFF: SafeInt(1),
        CAPTURED: SafeInt(0),
        LOST: SafeInt(0),
      },
      inventoryHash: "",
    };
    const hashed = withAircraftInventoryRecordHash(record);
    expect(hashed.inventoryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyAircraftInventoryRecordHash(hashed)).toBe(true);
  });

  it("identical inputs produce identical inventory hashes", () => {
    const base: AircraftInventoryRecord = {
      modelId: "spad_s_xiii_1917",
      conditionCounts: Object.fromEntries(
        AIRCRAFT_INVENTORY_STATES.map((s) => [s, SafeInt(0)]),
      ) as Record<string, SafeInt>,
      inventoryHash: "",
    };
    const a = withAircraftInventoryRecordHash(base);
    const b = withAircraftInventoryRecordHash(base);
    expect(a.inventoryHash).toBe(b.inventoryHash);
  });

  it("different inputs produce different inventory hashes", () => {
    const base = (u: number): AircraftInventoryRecord => ({
      modelId: "spad_s_xiii_1917",
      conditionCounts: Object.fromEntries(
        AIRCRAFT_INVENTORY_STATES.map((s, i) => [s, SafeInt(i === 0 ? u : 0)]),
      ) as Record<string, SafeInt>,
      inventoryHash: "",
    });
    expect(withAircraftInventoryRecordHash(base(10)).inventoryHash).not.toBe(
      withAircraftInventoryRecordHash(base(20)).inventoryHash,
    );
  });
});

describe("BasingSlot structure", () => {
  it("can construct a BasingSlot", () => {
    const slot: BasingSlot = {
      slotId: "slot-001",
      hostId: "base_cherbourg",
      aircraftModelId: "spad_s_xiii_1917",
      squadronId: "sqn_gc_12",
      condition: "ASSIGNED_OPERATIONAL",
      allocatedAt: "1917-06",
    };
    expect(slot.hostId).toBe("base_cherbourg");
    expect(slot.condition).toBe("ASSIGNED_OPERATIONAL");
  });
});

describe("SquadronState structure", () => {
  it("can construct a SquadronState with experience 0-100", () => {
    const sqn: SquadronState = {
      squadronId: "sqn_gc_12",
      ownerNationId: "nation_france",
      squadronRole: "FIGHTER",
      assignedModelId: "spad_s_xiii_1917",
      authorizedStrength: SafeInt(18),
      operationalAircraftCount: SafeInt(15),
      damagedAircraftCount: SafeInt(2),
      replacementAircraftReserved: SafeInt(3),
      pilotCount: SafeInt(16),
      squadronExperience: SafeInt(65),
      fatigue: SafeInt(20),
      trainingState: "OPERATIONAL",
      baseOrCarrierId: "base_cherbourg",
      reequipmentState: "NONE",
      expansionState: "NONE",
      missionAvailability: ["CAP", "ESCORT"],
      rulesetVersion: "aircraft_ruleset_v1",
      stateHash: "b".repeat(64),
    };
    expect(sqn.squadronRole).toBe("FIGHTER");
    expect(Number(sqn.authorizedStrength)).toBe(18);
    expect(Number(sqn.squadronExperience)).toBe(65);
    expect(sqn.reequipmentState).toBe("NONE");
  });
});
