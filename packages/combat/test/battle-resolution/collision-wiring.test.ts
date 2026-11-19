import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  playerBattleSessionHash,
  resolveBattleAuto,
  runPlayerBattleToEnd,
  type PlayerBattleOrders,
} from "@bluewave/combat/battleResolution";
import type { TerrainView } from "@bluewave/combat/terrain";
import {
  carryCollisionState,
  observeCollisionRecords,
  projectBattleCollision,
  withCollisionActivity,
} from "../../src/battleResolution/collisionWiring.js";
import { ATTACKER_NATION, makeAutoInput, makeNations } from "./fixtures.js";

const sea: TerrainView = { land: [], shallows: [], exclusions: [] };

const wall: TerrainView = {
  land: [
    {
      id: "wall",
      vertices: [
        { xM: 5_000, yM: -50_000 },
        { xM: 6_000, yM: -50_000 },
        { xM: 6_000, yM: 50_000 },
        { xM: 5_000, yM: 50_000 },
      ],
    },
  ],
  shallows: [],
  exclusions: [],
};

function hulled(nations: ReturnType<typeof makeNations>): ReturnType<typeof makeNations> {
  for (const designs of [nations.attackerDesigns, nations.defenderDesigns]) {
    for (const [id, design] of designs) {
      designs.set(id, { ...design, hullLengthMm: SafeInt(120_000), hullBeamMm: SafeInt(14_000) });
    }
  }
  return nations;
}

describe("projectBattleCollision", () => {
  it("projects nothing without hulls or terrain", () => {
    expect(projectBattleCollision({ designs: { a1: {} } })).toBeUndefined();
  });

  it("skips designs without both hull dimensions", () => {
    const collision = projectBattleCollision({
      designs: { a1: { hullLengthMm: 100_000 }, a2: { hullBeamMm: 12_000 } },
    });
    expect(collision).toBeUndefined();
  });

  it("projects terrain alone", () => {
    const collision = projectBattleCollision({ designs: {}, terrain: sea });
    expect(collision?.terrain).toBe(sea);
    expect(collision?.shipCollision).toBeUndefined();
  });

  it("projects a ship collision context from hull millimetres", () => {
    const collision = projectBattleCollision({
      designs: { a1: { hullLengthMm: 120_000, hullBeamMm: 14_000 }, a2: {} },
    });
    expect(Object.keys(collision?.shipCollision?.ships ?? {})).toEqual(["a1"]);
    expect(collision?.terrain).toBeUndefined();
  });
});

describe("collision state and activity", () => {
  it("carries a collision state only into a defined context", () => {
    const state = { speedCaps: {}, inContact: ["a1|d1"] };
    expect(carryCollisionState(undefined, state)).toBeUndefined();
    const context = { terrain: sea };
    expect(carryCollisionState(context, undefined)).toBe(context);
    expect(carryCollisionState(context, state)).toEqual({ terrain: sea, state });
  });

  it("reports activity only when a context exists and something happened", () => {
    const tally = { collisions: 0, terrainBlocks: 0 };
    observeCollisionRecords(tally, [
      {
        kind: "COLLISION",
        minute: 1,
        substep: 0,
        shipAId: "a1",
        shipBId: "d1",
        closingSpeedMps: 3,
        bearingDeg: 10,
      },
      {
        kind: "TERRAIN_BLOCKED",
        minute: 2,
        substep: 1,
        shipAId: "a1",
        shipBId: "",
        closingSpeedMps: 0,
        bearingDeg: 0,
      },
    ]);
    expect(tally).toEqual({ collisions: 1, terrainBlocks: 1 });
    expect(withCollisionActivity(undefined, tally)).toEqual({});
    expect(withCollisionActivity({ terrain: sea }, { collisions: 0, terrainBlocks: 0 })).toEqual(
      {},
    );
    expect(withCollisionActivity({ terrain: sea }, tally)).toEqual({
      collisionActivity: { collisions: 1, terrainBlocks: 1 },
    });
  });
});

const ORDERS: PlayerBattleOrders = { divisions: {} };

function playerInput(extra: { terrain?: TerrainView } = {}) {
  return { ...makeAutoInput(), playerNationId: ATTACKER_NATION, ...extra };
}

describe("player session collision wiring", () => {
  it("holds no collision context and an unchanged hash without hulls or terrain", () => {
    const session = createPlayerBattleSession(playerInput());
    expect(session.collision).toBeUndefined();
    const ended = runPlayerBattleToEnd(session, ORDERS);
    expect(ended.collision).toBeUndefined();
    expect(playerBattleSessionHash(ended)).toBe(
      playerBattleSessionHash(
        runPlayerBattleToEnd(createPlayerBattleSession(playerInput()), ORDERS),
      ),
    );
  });

  it("keeps the terrain on the session and advances deterministically against a wall", () => {
    const session = createPlayerBattleSession(playerInput({ terrain: wall }));
    expect(session.collision?.terrain).toBe(wall);
    const first = runPlayerBattleToEnd(session, ORDERS);
    const second = runPlayerBattleToEnd(
      createPlayerBattleSession(playerInput({ terrain: wall })),
      ORDERS,
    );
    expect(playerBattleSessionHash(first)).toBe(playerBattleSessionHash(second));
    expect(first.log.some((event) => event.eventType === "terrain_blocked")).toBe(true);
  });

  it("stepping one minute at a time equals running to the end with terrain", () => {
    const stepped = advancePlayerBattleMinute(
      createPlayerBattleSession(playerInput({ terrain: wall })),
      ORDERS,
    );
    const finished = runPlayerBattleToEnd(stepped, ORDERS);
    const direct = runPlayerBattleToEnd(
      createPlayerBattleSession(playerInput({ terrain: wall })),
      ORDERS,
    );
    expect(playerBattleSessionHash(finished)).toBe(playerBattleSessionHash(direct));
  });

  it("hashes the collision state only when one exists", () => {
    const withSea = createPlayerBattleSession(playerInput({ terrain: sea }));
    const without = createPlayerBattleSession(playerInput());
    expect(playerBattleSessionHash(withSea)).toBe(playerBattleSessionHash(without));
    const stateful = {
      ...withSea,
      collision: { ...withSea.collision, state: { speedCaps: {}, inContact: ["a1|d1"] } },
    };
    expect(playerBattleSessionHash(stateful)).not.toBe(playerBattleSessionHash(withSea));
  });
});

describe("resolveBattleAuto collision wiring", () => {
  it("changes no hash and reports no activity without hulls or terrain", () => {
    const result = resolveBattleAuto(makeAutoInput());
    expect(result.collisionActivity).toBeUndefined();
    expect(resolveBattleAuto(makeAutoInput()).resultHash).toBe(result.resultHash);
  });

  it("an empty terrain view leaves the result hash unchanged", () => {
    const base = resolveBattleAuto(makeAutoInput());
    const withSea = resolveBattleAuto({ ...makeAutoInput(), terrain: sea });
    expect(withSea.resultHash).toBe(base.resultHash);
    expect(withSea.collisionActivity).toBeUndefined();
  });

  it("runs deterministically with hulled designs", () => {
    const a = resolveBattleAuto(makeAutoInput({ nations: hulled(makeNations()) }));
    const b = resolveBattleAuto(makeAutoInput({ nations: hulled(makeNations()) }));
    expect(b.resultHash).toBe(a.resultHash);
    expect(b.collisionActivity).toEqual(a.collisionActivity);
  });

  it("blocks movement on land, records it and keeps the activity out of the result hash body", () => {
    const first = resolveBattleAuto({ ...makeAutoInput(), terrain: wall });
    const second = resolveBattleAuto({ ...makeAutoInput(), terrain: wall });
    expect(first.collisionActivity?.terrainBlocks ?? 0).toBeGreaterThan(0);
    expect(second.resultHash).toBe(first.resultHash);
    expect(second.collisionActivity).toEqual(first.collisionActivity);
  });
});
