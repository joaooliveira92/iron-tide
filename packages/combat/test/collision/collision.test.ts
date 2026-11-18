import { describe, expect, it } from "vite-plus/test";
import type { MovementState } from "@bluewave/combat/movement";
import type { TacticalBattleState } from "@bluewave/combat/tactical";
import { advanceMinutes, type UnitOrders } from "@bluewave/combat/simulation";
import {
  PROVISIONAL_COLLISION_RULES,
  collisionRadiusM,
  type CollisionContext,
} from "@bluewave/combat/collision";
import { initialDamageState } from "@bluewave/combat/battleResolution";
import type { DamageContext } from "../../src/damage/minuteDamage.js";
import { buildTestState } from "../simulation/advance.test.js";

const M = 1_000_000;
const OBSERVATION = "1900-01-01T00:00:00.000Z";
const KNOT_BP = 1_000;

function ship(position: [number, number], heading: number, speedBp: number): MovementState {
  return {
    position,
    heading,
    orderedSpeed: speedBp,
    currentSpeed: speedBp,
    acceleration: 0,
    turningRate: 1_000,
    collisionRadius: 5_000_000,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
  };
}

function pair(
  a: [number, number],
  b: [number, number],
  speedBp = 10 * KNOT_BP,
): TacticalBattleState {
  const base = buildTestState();
  return {
    ...base,
    movementStates: { a1: ship(a, 0, speedBp), d1: ship(b, 180, speedBp) },
  };
}

const orders: Record<string, UnitOrders> = {
  a1: { orderedHeading: 0, orderedSpeedBp: 10 * KNOT_BP },
  d1: { orderedHeading: 180, orderedSpeedBp: 10 * KNOT_BP },
};

const dimensions = {
  a1: { lengthM: 100, beamM: 14 },
  d1: { lengthM: 100, beamM: 14 },
};

function context(extra: Partial<CollisionContext> = {}): CollisionContext {
  return { shipCollision: { rules: PROVISIONAL_COLLISION_RULES, ships: dimensions }, ...extra };
}

function damageContext(): DamageContext {
  const target = (id: string) => ({
    shipId: id,
    zones: [],
    compartments: initialDamageState(id).compartments,
    components: initialDamageState(id).components,
    state: initialDamageState(id),
    designFlotationReserve: 400_000,
    designStabilityScore: 8_000,
    designDisplacementKg: 10_000_000,
    beltArmorUm: 200_000,
    mainGunsCaliberUm: 300_000,
    shipType: "CRUISER",
    maxHitPoints: 1_000,
  });
  return { battleId: "b1", targets: { a1: target("a1"), d1: target("d1") } };
}

function run(
  state: TacticalBattleState,
  collision: CollisionContext | undefined,
  minutes = 1,
  extra: { damage?: DamageContext } = {},
) {
  return advanceMinutes({
    state,
    minutes,
    observationTime: OBSERVATION,
    orders,
    ...(collision ? { collision } : {}),
    ...extra,
  });
}

describe("collision radius", () => {
  it("derives from design length and beam in whole metres", () => {
    expect(collisionRadiusM(PROVISIONAL_COLLISION_RULES, { lengthM: 100, beamM: 14 })).toBe(32);
    expect(collisionRadiusM(PROVISIONAL_COLLISION_RULES, { lengthM: 150, beamM: 16 })).toBe(48);
  });
});

describe("ship-on-ship collision inside the propulsion loop", () => {
  const head = pair([0, 0], [200 * M, 0]);

  it("leaves every hash untouched when nothing collides", () => {
    const apart = pair([0, 0], [60_000 * M, 0]);
    expect(run(apart, context()).hashes).toEqual(run(apart, undefined).hashes);
    expect(run(head, undefined, 1).hashes).toEqual(run(head, undefined, 1).hashes);
  });

  it("records one COLLISION with ids, closing speed and bearing, and caps both ships", () => {
    const res = run(head, context());
    const records = res.results[0]!.collisionRecords ?? [];
    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record).toMatchObject({ kind: "COLLISION", shipAId: "a1", shipBId: "d1", minute: 1 });
    expect(record.closingSpeedMps).toBeGreaterThan(0);
    expect(record.bearingDeg).toBe(0);
    const events = res.results[0]!.events.filter((e) => e.eventType === "collision");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: "a1", targetId: "d1" });
    const final = res.results[0]!.movementStates;
    for (const id of ["a1", "d1"]) {
      expect(final[id]!.currentSpeed).toBeLessThanOrEqual(PROVISIONAL_COLLISION_RULES.speedCapBp);
    }
    expect(res.results[0]!.collisionState?.speedCaps["a1"]?.capBp).toBe(
      PROVISIONAL_COLLISION_RULES.speedCapBp,
    );
  });

  it("does not collide again while the ships stay in contact, across minutes", () => {
    const res = run(head, context(), 3);
    const all = res.results.flatMap((r) => r.collisionRecords ?? []);
    expect(all).toHaveLength(1);
  });

  it("sorts the pair by asset id whatever the unit order", () => {
    const flipped: TacticalBattleState = { ...head, units: [...head.units!].reverse() };
    expect(run(flipped, context()).results[0]!.collisionRecords).toEqual(
      run(head, context()).results[0]!.collisionRecords,
    );
  });

  it("hands a COLLISION impact to the damage module for both ships", () => {
    const res = run(head, context(), 1, { damage: damageContext() });
    const states = res.results[0]!.damageStates!;
    for (const id of ["a1", "d1"]) {
      expect(states[id]!.structuralIntegrity).toBeLessThan(100_000);
      expect(states[id]!.flotationReserve).toBeLessThan(400_000);
    }
    const damageEvents = res.results[0]!.events.filter((e) => e.eventType === "damage_impact");
    expect(damageEvents.length).toBe(2);
  });

  it("scales damage with the closing speed", () => {
    const slow = pair([0, 0], [200 * M, 0], 3 * KNOT_BP);
    const slowOrders = {
      a1: { orderedHeading: 0, orderedSpeedBp: 3 * KNOT_BP },
      d1: { orderedHeading: 180, orderedSpeedBp: 3 * KNOT_BP },
    };
    const fast = run(head, context(), 1, { damage: damageContext() });
    const slowRun = advanceMinutes({
      state: slow,
      minutes: 2,
      observationTime: OBSERVATION,
      orders: slowOrders,
      collision: context(),
      damage: damageContext(),
    });
    const slowDamage = slowRun.results.map((r) => r.damageStates).find((s) => s !== undefined);
    expect(slowDamage).toBeDefined();
    const fastIntegrity = fast.results[0]!.damageStates!["a1"]!.structuralIntegrity;
    const slowIntegrity = slowDamage!["a1"]!.structuralIntegrity;
    expect(slowIntegrity).toBeGreaterThan(fastIntegrity);
  });

  it("applies the speed cap to a ship even when no damage context exists", () => {
    const res = run(head, context(), 1);
    expect(res.results[0]!.damageStates).toBeUndefined();
    expect(res.results[0]!.movementStates["a1"]!.currentSpeed).toBeLessThanOrEqual(
      PROVISIONAL_COLLISION_RULES.speedCapBp,
    );
  });
});

describe("terrain blocking", () => {
  const land = {
    land: [
      {
        id: "island",
        vertices: [
          { xM: 100, yM: -500 },
          { xM: 2000, yM: -500 },
          { xM: 2000, yM: 500 },
          { xM: 100, yM: 500 },
        ],
      },
    ],
    shallows: [],
    exclusions: [],
  };
  const lone: TacticalBattleState = {
    ...buildTestState(),
    movementStates: { a1: ship([0, 0], 0, 10 * KNOT_BP), d1: ship([0, 40_000 * M], 180, 0) },
  };

  it("cancels movement into land, decays speed and records once per ship per minute", () => {
    const res = run(lone, { terrain: land }, 2);
    for (const result of res.results) {
      const blocked = result.events.filter(
        (e) => e.eventType === "terrain_blocked" && e.actorId === "a1",
      );
      expect(blocked).toHaveLength(1);
      expect(result.collisionRecords?.filter((r) => r.kind === "TERRAIN_BLOCKED")).toHaveLength(1);
    }
    const first = res.results[0]!.movementStates["a1"]!;
    const second = res.results[1]!.movementStates["a1"]!;
    expect(first.position[0]).toBeLessThan(100 * M);
    expect(second.position[0]).toBeGreaterThanOrEqual(first.position[0]);
    expect(second.position[0]).toBeLessThan(100 * M);
    expect(second.currentSpeed).toBeLessThan(first.currentSpeed);
    expect(first.currentSpeed).toBeLessThan(10 * KNOT_BP);
  });

  it("stays dormant when the ship is clear of terrain", () => {
    const clear = { ...land, land: [] };
    expect(run(lone, { terrain: clear }, 2).hashes).toEqual(run(lone, undefined, 2).hashes);
  });

  it("lets a ship that starts inside land leave it", () => {
    const inside: TacticalBattleState = {
      ...lone,
      movementStates: {
        a1: ship([500 * M, 0], 180, 10 * KNOT_BP),
        d1: ship([0, 40_000 * M], 0, 0),
      },
    };
    const res = advanceMinutes({
      state: inside,
      minutes: 1,
      observationTime: OBSERVATION,
      orders: { a1: { orderedHeading: 180, orderedSpeedBp: 10 * KNOT_BP } },
      collision: { terrain: land },
    });
    expect(res.results[0]!.movementStates["a1"]!.position[0]).toBeLessThan(500 * M);
  });
});
