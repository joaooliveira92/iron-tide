import { describe, it, expect } from "vite-plus/test";
import {
  allocateDamageControl,
  createDefaultDamageControlResource,
  getEffectivePumping,
  getEffectiveFirefighting,
  getEffectiveRepairReduction,
  getFirePriorityCategory,
  getFloodingPriorityCategory,
  type DamageControlAllocation,
  DAMAGE_CONTROL_PRIORITIES,
} from "@bluewave/combat/damage";
import type { FireSourceRecord, FloodingSourceRecord } from "@bluewave/combat/damage";

function makeFire(
  locationId: string,
  intensityBp: number,
  cause = "FIRE_SOURCE_CREATED",
): FireSourceRecord {
  return { locationId, intensityBp, cause };
}

function makeFlood(
  compartmentId: string,
  rateKgMin: number,
  cause = "FLOODING_SOURCE_CREATED",
): FloodingSourceRecord {
  return { compartmentId, rateKgMin, cause };
}

const defaultResources = createDefaultControlResource();

function createDefaultControlResource() {
  return {
    teamCount: 4,
    pumpingCapacity: 800,
    firefightingCapacity: 500,
    emergencyPower: false,
    availableCrew: 200,
    specialists: 8,
    repairMaterials: 1000,
    compartmentAccess: [],
  };
}

describe("INC-7: getFirePriorityCategory", () => {
  it("intensity >= 5_000 returns UNCONTROLLED_MAJOR_FIRE", () => {
    expect(getFirePriorityCategory(5_000)).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(getFirePriorityCategory(7_500)).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(getFirePriorityCategory(10_000)).toBe("UNCONTROLLED_MAJOR_FIRE");
  });

  it("intensity < 5_000 returns WEAPON_RESTORATION", () => {
    expect(getFirePriorityCategory(0)).toBe("WEAPON_RESTORATION");
    expect(getFirePriorityCategory(1_000)).toBe("WEAPON_RESTORATION");
    expect(getFirePriorityCategory(4_999)).toBe("WEAPON_RESTORATION");
  });
});

describe("INC-7: getFloodingPriorityCategory", () => {
  it("CRITICAL returns CRITICAL_FLOODING", () => {
    expect(getFloodingPriorityCategory("CRITICAL")).toBe("CRITICAL_FLOODING");
  });

  it("MAJOR returns CRITICAL_FLOODING", () => {
    expect(getFloodingPriorityCategory("MAJOR")).toBe("CRITICAL_FLOODING");
  });

  it("SERIOUS returns NON_CRITICAL_DEWATERING", () => {
    expect(getFloodingPriorityCategory("SERIOUS")).toBe("NON_CRITICAL_DEWATERING");
  });

  it("MINOR returns NON_CRITICAL_DEWATERING", () => {
    expect(getFloodingPriorityCategory("MINOR")).toBe("NON_CRITICAL_DEWATERING");
  });
});

describe("INC-7: createDefaultDamageControlResource", () => {
  it("has correct default values", () => {
    const r = createDefaultDamageControlResource();
    expect(r.teamCount).toBe(4);
    expect(r.pumpingCapacity).toBe(800);
    expect(r.firefightingCapacity).toBe(500);
    expect(r.emergencyPower).toBe(false);
    expect(r.availableCrew).toBe(200);
    expect(r.specialists).toBe(8);
    expect(r.repairMaterials).toBe(1_000);
    expect(r.compartmentAccess).toEqual([]);
  });
});

describe("INC-7: getEffectivePumping", () => {
  it("sums pumping from allocations", () => {
    const allocs: DamageControlAllocation[] = [
      {
        priority: "CRITICAL_FLOODING",
        allocatedTeams: 1,
        allocatedPumping: 200,
        allocatedFirefighting: 0,
        targetId: "COMP-1",
        severity: "CRITICAL",
      },
      {
        priority: "NON_CRITICAL_DEWATERING",
        allocatedTeams: 1,
        allocatedPumping: 150,
        allocatedFirefighting: 0,
        targetId: "COMP-2",
        severity: "SERIOUS",
      },
    ];
    expect(getEffectivePumping(allocs)).toBe(350);
  });

  it("returns 0 for empty allocations", () => {
    expect(getEffectivePumping([])).toBe(0);
  });
});

describe("INC-7: getEffectiveFirefighting", () => {
  it("sums firefighting from allocations", () => {
    const allocs: DamageControlAllocation[] = [
      {
        priority: "UNCONTROLLED_MAJOR_FIRE",
        allocatedTeams: 1,
        allocatedPumping: 0,
        allocatedFirefighting: 125,
        targetId: "COMP-A",
        severity: "intensity_6000",
      },
      {
        priority: "WEAPON_RESTORATION",
        allocatedTeams: 1,
        allocatedPumping: 0,
        allocatedFirefighting: 100,
        targetId: "COMP-B",
        severity: "intensity_3000",
      },
    ];
    expect(getEffectiveFirefighting(allocs)).toBe(225);
  });

  it("returns 0 for empty allocations", () => {
    expect(getEffectiveFirefighting([])).toBe(0);
  });
});

describe("INC-7: getEffectiveRepairReduction", () => {
  it("sums repair reduction as 50 per allocated team", () => {
    const allocs: DamageControlAllocation[] = [
      {
        priority: "CRITICAL_FLOODING",
        allocatedTeams: 2,
        allocatedPumping: 400,
        allocatedFirefighting: 0,
        targetId: "COMP-1",
        severity: "CRITICAL",
      },
      {
        priority: "UNCONTROLLED_MAJOR_FIRE",
        allocatedTeams: 1,
        allocatedPumping: 0,
        allocatedFirefighting: 125,
        targetId: "COMP-A",
        severity: "intensity_7000",
      },
    ];
    expect(getEffectiveRepairReduction(allocs)).toBe(150);
  });

  it("returns 0 for empty allocations", () => {
    expect(getEffectiveRepairReduction([])).toBe(0);
  });
});

describe("INC-7: allocateDamageControl — no sources", () => {
  it("returns empty allocations when no fire or flooding sources", () => {
    const result = allocateDamageControl(defaultResources, [], [], 0);
    expect(result.allocations).toHaveLength(0);
    expect(result.remainingResources.teamCount).toBe(4);
    expect(result.remainingResources.pumpingCapacity).toBe(800);
    expect(result.remainingResources.firefightingCapacity).toBe(500);
  });
});

describe("INC-7: allocateDamageControl — priority ordering", () => {
  it("magazine hazard (high-intensity fire) gets priority", () => {
    const fires: FireSourceRecord[] = [makeFire("MAG-1", 8_000)];
    const floods: FloodingSourceRecord[] = [makeFlood("COMP-1", 300)];
    const result = allocateDamageControl(defaultResources, fires, floods, 3_000);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.priority).toBe("CRITICAL_FLOODING");
    expect(result.allocations[0]!.targetId).toBe("COMP-1");
    expect(result.allocations[1]!.priority).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(result.allocations[1]!.targetId).toBe("MAG-1");
  });

  it("CRITICAL_FLOODING gets priority over UNCONTROLLED_MAJOR_FIRE", () => {
    const fires: FireSourceRecord[] = [makeFire("FIRE-1", 7_500)];
    const floods: FloodingSourceRecord[] = [makeFlood("FLOOD-1", 500)];
    const result = allocateDamageControl(defaultResources, fires, floods, 3_000);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.priority).toBe("CRITICAL_FLOODING");
    expect(result.allocations[1]!.priority).toBe("UNCONTROLLED_MAJOR_FIRE");
  });

  it("fire and flood both allocated when both present", () => {
    const fires: FireSourceRecord[] = [makeFire("FIRE-1", 6_000)];
    const floods: FloodingSourceRecord[] = [makeFlood("FLOOD-1", 400)];
    const result = allocateDamageControl(defaultResources, fires, floods, 2_000);
    expect(result.allocations.length).toBeGreaterThanOrEqual(2);
    const priorities = result.allocations.map((a) => a.priority);
    expect(priorities).toContain("CRITICAL_FLOODING");
    expect(priorities).toContain("UNCONTROLLED_MAJOR_FIRE");
  });

  it("higher severity (intensity) gets resources first within same priority", () => {
    const fires: FireSourceRecord[] = [
      makeFire("FIRE-LOW", 3_000),
      makeFire("FIRE-HIGH", 6_000),
      makeFire("FIRE-MID", 8_000),
    ];
    const result = allocateDamageControl(createDefaultControlResource(), fires, [], 0);
    expect(result.allocations[0]!.priority).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(result.allocations[1]!.priority).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(result.allocations[0]!.targetId).toBe("FIRE-MID");
    expect(result.allocations[1]!.targetId).toBe("FIRE-HIGH");
  });

  it("equal-priority sources ordered by source id ascending when severity equal", () => {
    const fires: FireSourceRecord[] = [makeFire("B-FIRE", 6_000), makeFire("A-FIRE", 6_000)];
    const result = allocateDamageControl(createDefaultControlResource(), fires, [], 0);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.targetId).toBe("A-FIRE");
    expect(result.allocations[1]!.targetId).toBe("B-FIRE");
  });
});

describe("INC-7: allocateDamageControl — resource tracking", () => {
  it("resources tracked correctly (no double allocation)", () => {
    const resources = createDefaultControlResource();
    const fires: FireSourceRecord[] = [makeFire("FIRE-1", 6_000), makeFire("FIRE-2", 7_000)];
    const floods: FloodingSourceRecord[] = [makeFlood("FLOOD-1", 500), makeFlood("FLOOD-2", 400)];
    const result = allocateDamageControl(resources, fires, floods, 3_000);

    expect(result.allocations).toHaveLength(4);

    const totalTeams = result.allocations
      .map((a) => a.allocatedTeams)
      .reduce((sum, v) => sum + v, 0);
    expect(totalTeams).toBe(4);
    expect(result.remainingResources.teamCount).toBe(0);

    const totalPumping = getEffectivePumping(result.allocations);
    expect(totalPumping).toBe(400);
    expect(result.remainingResources.pumpingCapacity).toBe(400);

    const totalFirefighting = getEffectiveFirefighting(result.allocations);
    expect(totalFirefighting).toBe(250);
    expect(result.remainingResources.firefightingCapacity).toBe(250);
  });

  it("remaining resources returned correctly", () => {
    const resources = createDefaultControlResource();
    const fires: FireSourceRecord[] = [makeFire("FIRE-1", 6_000)];
    const result = allocateDamageControl(resources, fires, [], 0);

    expect(result.allocations).toHaveLength(1);
    expect(result.remainingResources.teamCount).toBe(3);
    expect(result.remainingResources.pumpingCapacity).toBe(800);
    expect(result.remainingResources.firefightingCapacity).toBe(375);
    expect(result.remainingResources.emergencyPower).toBe(false);
    expect(result.remainingResources.availableCrew).toBe(200);
    expect(result.remainingResources.specialists).toBe(8);
    expect(result.remainingResources.repairMaterials).toBe(1000);
    expect(result.remainingResources.compartmentAccess).toEqual([]);
  });

  it("insufficient resources — runs out of teams", () => {
    const limitedResources = { ...createDefaultControlResource(), teamCount: 1 };
    const fires: FireSourceRecord[] = [
      makeFire("FIRE-1", 6_000),
      makeFire("FIRE-2", 7_000),
      makeFire("FIRE-3", 8_000),
    ];
    const result = allocateDamageControl(limitedResources, fires, [], 0);

    expect(result.allocations).toHaveLength(1);
    expect(result.remainingResources.teamCount).toBe(0);
    expect(result.allocations[0]!.targetId).toBe("FIRE-3");
  });
});

describe("INC-7: allocateDamageControl — full cycles", () => {
  it("full allocation cycle with 2 fires + 1 flood", () => {
    const fires: FireSourceRecord[] = [makeFire("ENGINE-ROOM", 8_000), makeFire("GALLEY", 2_000)];
    const floods: FloodingSourceRecord[] = [makeFlood("HULL-1", 600)];
    const result = allocateDamageControl(createDefaultControlResource(), fires, floods, 3_500);

    expect(result.allocations).toHaveLength(3);

    expect(result.allocations[0]!.priority).toBe("CRITICAL_FLOODING");
    expect(result.allocations[1]!.priority).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(result.allocations[2]!.priority).toBe("WEAPON_RESTORATION");

    expect(result.remainingResources.teamCount).toBe(1);
  });

  it("all 9 priority levels represented in output structure", () => {
    expect(DAMAGE_CONTROL_PRIORITIES).toHaveLength(9);
    expect(DAMAGE_CONTROL_PRIORITIES[0]).toBe("MAGAZINE_TORPEDO_AVIATION_REACTOR");
    expect(DAMAGE_CONTROL_PRIORITIES[1]).toBe("CRITICAL_FLOODING");
    expect(DAMAGE_CONTROL_PRIORITIES[2]).toBe("UNCONTROLLED_MAJOR_FIRE");
    expect(DAMAGE_CONTROL_PRIORITIES[3]).toBe("STEERING_PROPULSION");
    expect(DAMAGE_CONTROL_PRIORITIES[4]).toBe("ELECTRICAL_POWER");
    expect(DAMAGE_CONTROL_PRIORITIES[5]).toBe("FIRE_CONTROL_COMMUNICATIONS");
    expect(DAMAGE_CONTROL_PRIORITIES[6]).toBe("WEAPON_RESTORATION");
    expect(DAMAGE_CONTROL_PRIORITIES[7]).toBe("NON_CRITICAL_DEWATERING");
    expect(DAMAGE_CONTROL_PRIORITIES[8]).toBe("COSMETIC_REPAIR");
  });

  it("all resources fully consumed (stress test)", () => {
    const fires: FireSourceRecord[] = [
      makeFire("FIRE-A", 9_000),
      makeFire("FIRE-B", 8_500),
      makeFire("FIRE-C", 1_000),
      makeFire("FIRE-D", 7_500),
    ];
    const result = allocateDamageControl(createDefaultControlResource(), fires, [], 0);
    expect(result.allocations).toHaveLength(4);
    expect(result.remainingResources.teamCount).toBe(0);
    expect(result.remainingResources.firefightingCapacity).toBe(0);
    expect(result.remainingResources.pumpingCapacity).toBe(800);
  });

  it("flooding-only allocation uses pumping capacity", () => {
    const floods: FloodingSourceRecord[] = [
      makeFlood("COMP-1", 300),
      makeFlood("COMP-2", 200),
      makeFlood("COMP-3", 100),
    ];
    const result = allocateDamageControl(createDefaultControlResource(), [], floods, 1_000);

    expect(result.allocations).toHaveLength(3);
    expect(getEffectivePumping(result.allocations)).toBe(600);
    expect(result.remainingResources.pumpingCapacity).toBe(200);
    expect(result.remainingResources.teamCount).toBe(1);

    for (const alloc of result.allocations) {
      expect(alloc.priority).toBe("NON_CRITICAL_DEWATERING");
    }
  });

  it("fire-only allocation with all high-intensity fires", () => {
    const fires: FireSourceRecord[] = [
      makeFire("TURRET-1", 6_000),
      makeFire("TURRET-2", 7_000),
      makeFire("TURRET-3", 5_500),
      makeFire("TURRET-4", 8_000),
    ];
    const result = allocateDamageControl(createDefaultControlResource(), fires, [], 0);

    expect(result.allocations).toHaveLength(4);
    expect(result.allocations[0]!.targetId).toBe("TURRET-4");
    expect(result.allocations[1]!.targetId).toBe("TURRET-2");
    expect(result.allocations[2]!.targetId).toBe("TURRET-1");
    expect(result.allocations[3]!.targetId).toBe("TURRET-3");

    for (const alloc of result.allocations) {
      expect(alloc.priority).toBe("UNCONTROLLED_MAJOR_FIRE");
    }

    expect(result.remainingResources.firefightingCapacity).toBe(0);
    expect(result.remainingResources.teamCount).toBe(0);
  });

  it("mixed severities: CRITICAL vs MINOR flood priority", () => {
    const floods: FloodingSourceRecord[] = [makeFlood("COMP-1", 100), makeFlood("COMP-2", 500)];
    const resultCritical = allocateDamageControl(createDefaultControlResource(), [], floods, 3_000);
    expect(resultCritical.allocations).toHaveLength(2);
    expect(resultCritical.allocations[0]!.targetId).toBe("COMP-1");
    expect(resultCritical.allocations[0]!.priority).toBe("CRITICAL_FLOODING");
    expect(resultCritical.allocations[1]!.targetId).toBe("COMP-2");
    expect(resultCritical.allocations[1]!.priority).toBe("CRITICAL_FLOODING");

    const resultMinor = allocateDamageControl(createDefaultControlResource(), [], floods, 100);
    expect(resultMinor.allocations).toHaveLength(2);
    expect(resultMinor.allocations[0]!.priority).toBe("NON_CRITICAL_DEWATERING");
    expect(resultMinor.allocations[1]!.priority).toBe("NON_CRITICAL_DEWATERING");
  });

  it("low-intensity fire allocated after all higher priorities", () => {
    const fires: FireSourceRecord[] = [makeFire("FIRE-LOW", 500)];
    const floods: FloodingSourceRecord[] = [makeFlood("FLOOD-1", 400)];
    const result = allocateDamageControl(createDefaultControlResource(), fires, floods, 3_000);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.priority).toBe("CRITICAL_FLOODING");
    expect(result.allocations[1]!.priority).toBe("WEAPON_RESTORATION");
  });

  it("Allocation result has correct type structure", () => {
    const fires: FireSourceRecord[] = [makeFire("DECK-1", 6_000)];
    const result = allocateDamageControl(defaultResources, fires, [], 0);

    expect(result).toHaveProperty("allocations");
    expect(result).toHaveProperty("remainingResources");

    const alloc = result.allocations[0]!;
    expect(alloc).toHaveProperty("priority");
    expect(alloc).toHaveProperty("allocatedTeams");
    expect(alloc).toHaveProperty("allocatedPumping");
    expect(alloc).toHaveProperty("allocatedFirefighting");
    expect(alloc).toHaveProperty("targetId");
    expect(alloc).toHaveProperty("severity");

    expect(alloc.allocatedTeams).toBe(1);
    expect(alloc.allocatedPumping).toBe(0);
    expect(alloc.allocatedFirefighting).toBe(125);
    expect(alloc.targetId).toBe("DECK-1");
  });
});
