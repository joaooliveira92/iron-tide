//packages/combat/test/damage/advance.test.ts
// INC-4 — resolveDamage integration + strict no-op path.
// Tests the engineWiring entry point end-to-end.
import { describe, it, expect } from "vite-plus/test";
import {
  resolveDamage,
  type GunneryImpact,
  withDamageStateHash,
  assertFixedPointDamage,
  type ShipDamageState,
} from "../../src/damage/index.js";

// ---------------------------------------------------------------------------
// Helpers

function baseState(overrides: Partial<ShipDamageState> = {}): ShipDamageState {
  return withDamageStateHash({
    shipId: "SHIP-001",
    compartments: ["COMP-1", "COMP-2"],
    components: ["TURRET-1", "ENGINE-1", "DIRECTOR-1"],
    structuralIntegrity: 100_000,
    flotationReserve: 50_000,
    stabilityScore: 8_000,
    fireRecords: [],
    floodingRecords: [],
    progressiveFloodingTotal: 0,
    performanceModifiers: {},
    terminalStatus: "NORMAL",
    rulesetVersion: "damage_ruleset_v1",
    formulaVersion: "damage_formula_v1",
    ...overrides,
  });
}

function sampleImpact(overrides: Partial<GunneryImpact> = {}): GunneryImpact {
  return {
    sourceId: "BATTERY-A",
    weaponId: "SHELL-AP-1",
    targetShipId: "SHIP-001",
    hitLocation: "TURRET-1",
    penetrationOutcome: "FULL_PENETRATION",
    splinterIntensity: "NONE",
    effectiveResistanceUm: 300_000,
    penetrationMargin: 50_000,
    structuralDamage: 5_000,
    flotationDamage: 2_000,
    // INC-5 defaults
    shipType: "ORDINARY",
    hasCombustible: false,
    hasOxygen: false,
    hullBreach: false,
    hasWaterRoute: false,
    hasMagazineInZone: false,
    hitZoneType: "TURRET_FACE",
    catastrophicBreakup: false,
    capsizeRisk: false,
    designFlotationReserve: 50_000,
    designStabilityScore: 10_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveDamage integration

describe("AC-4: resolveDamage integration", () => {
  it("processes a single impact and returns new state + events", () => {
    const state = baseState();
    const { newState, events } = resolveDamage(state, [sampleImpact()], 10, 2);

    expect(newState).toBeDefined();
    expect(newState.shipId).toBe("SHIP-001");
    expect(events).toHaveLength(1);

    // Structure/flotation should be reduced
    expect(newState.structuralIntegrity).toBeLessThan(100_000);
    expect(newState.flotationReserve).toBeLessThan(50_000);
  });

  it("produces a valid DamageEventRecord in the events array", () => {
    const state = baseState();
    const { events } = resolveDamage(state, [sampleImpact()], 10, 2);

    const event = events[0];
    expect(event.battleMinute).toBe(10);
    expect(event.substep).toBe(2);
    expect(event.sourceId).toBe("BATTERY-A");
    expect(event.targetShipId).toBe("SHIP-001");
    expect(event.causalWeaponId).toBe("SHELL-AP-1");
    expect(event.hitLocation).toBe("TURRET-1");
    expect(event.protectionInteraction.outcome).toBe("FULL_PENETRATION");
    expect(event.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("processes multiple impacts in order", () => {
    const state = baseState();
    const impacts = [
      sampleImpact({ sourceId: "HIT-1", structuralDamage: 5_000 }),
      sampleImpact({ sourceId: "HIT-2", structuralDamage: 10_000 }),
    ];
    const { newState, events } = resolveDamage(state, impacts, 10, 2);

    expect(events).toHaveLength(2);
    expect(newState.structuralIntegrity).toBe(85_000); // 100_000 - 5_000 - 10_000
    expect(events[0].sourceId).toBe("HIT-1");
    expect(events[1].sourceId).toBe("HIT-2");
  });

  it("component effects are populated in the event record", () => {
    const state = baseState();
    const impact = sampleImpact({ hitLocation: "TURRET-1" });
    const { events } = resolveDamage(state, [impact], 10, 2);

    const event = events[0];
    // TURRET-1 is in zone TURRET-1 (same id)
    // With full penetration, NONE splinters → DEGRADED
    expect(event.componentEffects.length).toBeGreaterThan(0);
    const turretEffect = event.componentEffects.find((ce) => ce.componentId === "TURRET-1");
    expect(turretEffect).toBeDefined();
    expect(turretEffect!.outcome).toBe("DEGRADED");
  });

  it("structure/flotation effects are populated in the event record", () => {
    const state = baseState();
    const { events } = resolveDamage(state, [sampleImpact()], 10, 2);

    const event = events[0];
    expect(event.structureFlotationEffects.structuralIntegrityAfter).toBe(95_000);
    expect(event.structureFlotationEffects.flotationReserveAfter).toBe(48_000);
    expect(event.structureFlotationEffects.uncappedStructuralDamage).toBe(5_000);
    expect(event.structureFlotationEffects.uncappedFlotationDamage).toBe(2_000);
  });

  it("returned newState is a valid ShipDamageState", () => {
    const state = baseState();
    const { newState } = resolveDamage(state, [sampleImpact()], 10, 2);
    expect(() => assertFixedPointDamage(newState)).not.toThrow();
  });

  it("terminalTransition is null when structural integrity remains positive", () => {
    const state = baseState({ structuralIntegrity: 100_000 });
    const { events } = resolveDamage(state, [sampleImpact({ structuralDamage: 5_000 })], 10, 2);
    expect(events[0].terminalTransition).toBeNull();
  });

  it("terminalTransition is SINKING when flotation reserve reaches 0", () => {
    const state = baseState({ flotationReserve: 2_000 });
    const { events } = resolveDamage(state, [sampleImpact({ flotationDamage: 2_000 })], 10, 2);
    expect(events[0].terminalTransition).toBe("SINKING");
    // State should be terminal SINKING
  });

  it("state transitions to SINKING when flotation reserve drops to 0", () => {
    const state = baseState({ flotationReserve: 1_000, terminalStatus: "NORMAL" });
    const { newState } = resolveDamage(state, [sampleImpact({ flotationDamage: 2_000 })], 10, 2);
    expect(newState.terminalStatus).toBe("SINKING");
  });

  it("already-sinking ship stays sinking", () => {
    const state = baseState({ structuralIntegrity: 100_000, terminalStatus: "SINKING" });
    const { newState } = resolveDamage(state, [sampleImpact({ structuralDamage: 5_000 })], 10, 2);
    expect(newState.terminalStatus).toBe("SINKING");
  });

  it("already-foundered ship stays foundered", () => {
    const state = baseState({ structuralIntegrity: 100_000, terminalStatus: "FOUNDERED" });
    const { newState } = resolveDamage(state, [sampleImpact({ structuralDamage: 5_000 })], 10, 2);
    expect(newState.terminalStatus).toBe("FOUNDERED");
  });
});

// ---------------------------------------------------------------------------
// Strict no-op path

describe("AC-4: Strict no-op path", () => {
  it("returns state unchanged when impacts array is empty", () => {
    const state = baseState();
    const { newState, events } = resolveDamage(state, [], 10, 2);

    // Events array must be empty
    expect(events).toEqual([]);
    // State should be the same (same reference when hash already matches)
    expect(newState.structuralIntegrity).toBe(state.structuralIntegrity);
    expect(newState.flotationReserve).toBe(state.flotationReserve);
  });

  it("no-op path preserves state hash", () => {
    const state = baseState();
    const { newState } = resolveDamage(state, [], 10, 2);
    // State hash should be computed and valid
    expect(newState.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no-op path does not create events", () => {
    const state = baseState();
    const { events } = resolveDamage(state, [], 15, 3);
    expect(events).toHaveLength(0);
  });
});
