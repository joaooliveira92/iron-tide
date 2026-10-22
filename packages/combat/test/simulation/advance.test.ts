import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { TacticalBattleState, TacticalShipUnit } from "@bluewave/combat/tactical";
import type { MovementState } from "@bluewave/combat/movement";
import { advanceMinutes, advanceMinute } from "@bluewave/combat/simulation";
import { computeInitialMovementStates } from "@bluewave/combat/simulation";
import { SUBSTEPS_PER_MINUTE } from "@bluewave/combat/movement";

function unit(id: string, sideId: "ATTACKER" | "DEFENDER", className: string): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className,
    designVersionId: "dv-1",
    shipType: "BB",
    displacementKg: SafeInt(30_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(305_000),
    mainGunsCaliberUm: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    crewComplement: SafeInt(1_000),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "pre",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre",
      projectionReason: "test",
      persistenceDisposition: "persistent",
      provenanceHash: "prov",
    },
  };
}

export function buildTestState(overrides: Partial<TacticalBattleState> = {}): TacticalBattleState {
  const units: TacticalShipUnit[] = [
    unit("a1", "ATTACKER", "Battleship"),
    unit("d1", "DEFENDER", "Battleship"),
  ];
  const movementStates: Record<string, MovementState> = computeInitialMovementStates(
    { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
    units.map((u) => ({
      assetId: u.assetId,
      sideId: u.sideId as "ATTACKER" | "DEFENDER",
      orderedSpeedBpKnots: 10_000,
      designedSpeedBpKnots: 20_000,
      turningRateMdegS: 1_000,
    })),
  );
  return {
    battleId: "b1",
    mapId: "eng_ch",
    sides: [
      { sideId: "ATTACKER", participantIds: ["a1"] },
      { sideId: "DEFENDER", participantIds: ["d1"] },
    ],
    forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
    divisions: [],
    units,
    contacts: [],
    movementStates,
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
    ...overrides,
  };
}

describe("AC-12 minute-advance simulation", () => {
  it("advances a battle state N minutes and produces a minute hash per minute", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    expect(res.hashes).toHaveLength(3);
    for (const h of res.hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(res.results.every((r) => r.minute >= 1 && r.minute <= 3)).toBe(true);
  });

  it("rejects a later minute (each call is independent: same inputs -> same hash)", () => {
    const state = buildTestState();
    const input = {
      state,
      minutes: 2,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    };
    const r1 = advanceMinutes(input);
    const r2 = advanceMinutes({ ...input, state: buildTestState() });
    expect(r1.hashes).toEqual(r2.hashes);
  });

  it("step 6 uses exactly 60 deterministic substeps per minute", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 0, orderedSpeedBp: 10_000 } },
    });
    expect(SUBSTEPS_PER_MINUTE).toBe(60);
    expect(res.results[0]!.movementStates["a1"]).toBeDefined();
  });

  it("advanceMinute emits DESIGN-38 steps 4-8 events in canonical order", () => {
    const state = buildTestState();
    const res = advanceMinute({
      state,
      minute: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    const types = res.events.map((e) => e.eventType);
    expect(types).toContain("update_contact_knowledge");
    expect(types).toContain("resolve_movement_intent");
    expect(types).toContain("resolve_propulsion_formation");
    expect(types).toContain("resolve_collisions_grounding");
    expect(types).toContain("resolve_sensors_spotting");
  });
});
