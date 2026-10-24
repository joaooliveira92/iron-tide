import { RandomEngine } from "@bluewave/random";
import { describe, it, expect } from "vite-plus/test";
import {
  resolveDamage,
  type GunneryImpact,
  withDamageStateHash,
  type ShipDamageState,
} from "@bluewave/combat/damage";

function keyedDraw(seed: string): (stream: string) => number {
  const engine = new RandomEngine(seed);
  let drawCall = 0;
  return (stream) => {
    const domain = `${stream}:${String(drawCall)}`;
    drawCall += 1;
    return engine.stream(domain).next();
  };
}

const DET_SEED = "damage-determinism";

function baseState(overrides: Partial<ShipDamageState> = {}): ShipDamageState {
  return withDamageStateHash({
    shipId: "SHIP-DET",
    compartments: ["COMP-1", "COMP-2", "COMP-3"],
    components: ["TURRET-1", "ENGINE-1", "DIRECTOR-1", "RUDDER-1"],
    structuralIntegrity: 100_000,
    flotationReserve: 50_000,
    stabilityScore: 7_500,
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

function createImpact(overrides: Partial<GunneryImpact> = {}): GunneryImpact {
  return {
    sourceId: "BATTERY-DET",
    weaponId: "SHELL-AP-42",
    targetShipId: "SHIP-DET",
    hitLocation: "COMP-1",
    penetrationOutcome: "FULL_PENETRATION",
    splinterIntensity: "LIGHT",
    effectiveResistanceUm: 300_000,
    penetrationMargin: 75_000,
    structuralDamage: 12_000,
    flotationDamage: 5_000,
    shipType: "ORDINARY",
    hasCombustible: true,
    hasOxygen: true,
    hullBreach: true,
    hasWaterRoute: true,
    hasMagazineInZone: true,
    hitZoneType: "MAGAZINE",
    catastrophicBreakup: false,
    capsizeRisk: false,
    designFlotationReserve: 50_000,
    designStabilityScore: 10_000,
    ...overrides,
  };
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe("AC-5: Determinism — same inputs → byte-identical outputs", () => {
  it("resolveDamage produces identical state hashes on two runs", () => {
    const state = baseState();
    const impact = createImpact();

    const run1 = resolveDamage(state, [impact], 10, 3, keyedDraw(DET_SEED));
    const run2 = resolveDamage(state, [impact], 10, 3, keyedDraw(DET_SEED));

    expect(run1.newState.stateHash).toBe(run2.newState.stateHash);
  });

  it("resolveDamage produces identical event record hashes on two runs", () => {
    const state = baseState();
    const impact = createImpact();

    const run1 = resolveDamage(state, [impact], 10, 3, keyedDraw(DET_SEED));
    const run2 = resolveDamage(state, [impact], 10, 3, keyedDraw(DET_SEED));

    expect(run1.events).toHaveLength(run2.events.length);
    for (let i = 0; i < run1.events.length; i++) {
      expect(run1.events[i].recordHash).toBe(run2.events[i].recordHash);
    }
  });

  it("resolveDamage produces identical full output structure on two runs", () => {
    const state = baseState();
    const impact = createImpact();

    const run1 = resolveDamage(state, [impact], 10, 3, keyedDraw(DET_SEED));
    const run2 = resolveDamage(state, [impact], 10, 3, keyedDraw(DET_SEED));

    expect(jsonEqual(run1, run2)).toBe(true);
  });

  it("resolveDamage produces identical results with multiple impacts", () => {
    const state = baseState();
    const impacts = [
      createImpact({ sourceId: "HIT-1", hitLocation: "COMP-1" }),
      createImpact({ sourceId: "HIT-2", hitLocation: "COMP-2", hasMagazineInZone: false }),
    ];

    const run1 = resolveDamage(state, impacts, 10, 3, keyedDraw(DET_SEED));
    const run2 = resolveDamage(state, impacts, 10, 3, keyedDraw(DET_SEED));

    expect(jsonEqual(run1, run2)).toBe(true);
  });

  it("no-impacts path is deterministic", () => {
    const state = baseState();

    const run1 = resolveDamage(state, [], 10, 3, keyedDraw(DET_SEED));
    const run2 = resolveDamage(state, [], 10, 3, keyedDraw(DET_SEED));

    expect(jsonEqual(run1, run2)).toBe(true);
  });

  it("changing the RNG seed changes the event record when ignition is chance-based", () => {
    const state = baseState();
    const impact = createImpact({ shipType: "DESTROYER" });
    const seeds = ["seed-a", "seed-b", "seed-c", "seed-d", "seed-e", "seed-f", "seed-g", "seed-h"];

    const hashes = new Set(
      seeds.map(
        (seed) => resolveDamage(state, [impact], 10, 3, keyedDraw(seed)).events[0]?.recordHash,
      ),
    );

    expect(hashes.size).toBeGreaterThan(1);
  });
});

describe("AC-5: Determinism — same RNG, different order of impacts", () => {
  it("produces different results when impact order differs (order-dependent)", () => {
    const state = baseState();
    const impactA = createImpact({ sourceId: "HIT-A", structuralDamage: 5_000 });
    const impactB = createImpact({ sourceId: "HIT-B", structuralDamage: 15_000 });

    const ab = resolveDamage(state, [impactA, impactB], 10, 3, keyedDraw(DET_SEED));
    const ba = resolveDamage(state, [impactB, impactA], 10, 3, keyedDraw(DET_SEED));

    expect(ab.events[0].sourceId).toBe("HIT-A");
    expect(ba.events[0].sourceId).toBe("HIT-B");
  });
});
