import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  AirDefenseState,
  Category,
  Layer,
  ammunitionMultiplierBp,
  computeAirDefenseStateHash,
  consumeAmmunition,
  createAirDefenseState,
  createAirDefenseSystemDefinition,
  hasAmmunition,
  INVALID_AIR_DEFENSE_STATE,
  roundsForSystem,
} from "../../src/air-defense/index.js";

function directorState() {
  return {
    channelId: "ch001",
    assignedLayer: Layer.HEAVY_AA,
    directorIndex: SafeInt(0),
    scalingBp: SafeInt(10_000),
  };
}

function radarState() {
  return {
    channelId: "radar01",
    assignedLayer: Layer.HEAVY_AA,
    saturationGroup: SafeInt(0),
    diminishingReturnsBp: SafeInt(10_000),
  };
}

function makeSystem(overrides: Record<string, unknown> = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_001",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    roundsPerEngagement: SafeInt(5),
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set(["ch001"]),
    ...overrides,
  });
}

function makeState(
  system: ReturnType<typeof makeSystem>,
  ammo: ReadonlyArray<readonly [string, SafeInt]>,
): AirDefenseState {
  const state: AirDefenseState = {
    defenderId: "ship_001",
    scope: "SHIP",
    systems: [system],
    directorState: {
      channelId: "ch001",
      assignedLayer: Layer.HEAVY_AA,
      directorIndex: SafeInt(0),
      scalingBp: SafeInt(10_000),
    },
    radarState: {
      channelId: "radar01",
      assignedLayer: Layer.HEAVY_AA,
      saturationGroup: SafeInt(0),
      diminishingReturnsBp: SafeInt(10_000),
    },
    crewQuality: SafeInt(10_000),
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt.ZERO,
    ammunitionByType: new Map(ammo),
    targetAllocations: new Map<string, string>(),
    channelReservations: new Map<string, string>(),
    disruptionRecords: [],
    stateHash: "",
  };
  state.stateHash = computeAirDefenseStateHash(state);
  return state;
}

describe("AC-13: ammunition availability (§20)", () => {
  it("absent entry → assume present (documented basic model)", () => {
    const state = makeState(makeSystem(), []);
    expect(hasAmmunition(state, "sys_001")).toBe(true);
    expect(Number(ammunitionMultiplierBp(state, "sys_001"))).toBe(10_000);
  });

  it("an explicit 0 entry is empty: contributes zero", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt.ZERO]]);
    expect(hasAmmunition(state, "sys_001")).toBe(false);
    expect(Number(ammunitionMultiplierBp(state, "sys_001"))).toBe(0);
  });

  it("a present entry is full under the basic model (10_000 multiplier)", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(42)]]);
    expect(hasAmmunition(state, "sys_001")).toBe(true);
    expect(Number(ammunitionMultiplierBp(state, "sys_001"))).toBe(10_000);
    expect(Number(roundsForSystem(state, "sys_001"))).toBe(42);
  });
});

describe("AC-13: consumption (§20)", () => {
  it("decrements the tracked rounds by the requested amount", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(100)]]);
    const next = consumeAmmunition(state, "sys_001", SafeInt(10));
    expect(Number(next.ammunitionByType.get("sys_001"))).toBe(90);
  });

  it("defaults the consumption to the system's roundsPerEngagement", () => {
    const state = makeState(makeSystem({ roundsPerEngagement: SafeInt(5) }), [
      ["sys_001", SafeInt(100)],
    ]);
    const next = consumeAmmunition(state, "sys_001");
    expect(Number(next.ammunitionByType.get("sys_001"))).toBe(95);
  });

  it("never decrements below 0 — fails closed instead of silently flooring (Repair LOW-5)", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(3)]]);
    let caught: unknown;
    try {
      consumeAmmunition(state, "sys_001", SafeInt(5));
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
    expect((caught as BluewaveError).context).toMatchObject({ systemId: "sys_001" });
    expect(Number(state.ammunitionByType.get("sys_001"))).toBe(3);
  });

  it("a 0-round (empty) explicit entry never consumes (zero-contribution path)", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt.ZERO]]);
    const next = consumeAmmunition(state, "sys_001", SafeInt.ZERO);
    expect(Number(next.ammunitionByType.get("sys_001"))).toBe(0);
    expect(hasAmmunition(next, "sys_001")).toBe(false);
    expect(Number(ammunitionMultiplierBp(next, "sys_001"))).toBe(0);
  });

  it("is immutable: the original state's map is unchanged", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(100)]]);
    const next = consumeAmmunition(state, "sys_001", SafeInt(10));
    expect(Number(state.ammunitionByType.get("sys_001"))).toBe(100);
    expect(next).not.toBe(state);
    expect(next.ammunitionByType).not.toBe(state.ammunitionByType);
  });

  it("recomputes the state hash (mirrors addDisruptionRecord)", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(100)]]);
    const next = consumeAmmunition(state, "sys_001", SafeInt(10));
    expect(next.stateHash).not.toBe(state.stateHash);
    expect(next.stateHash).toBe(computeAirDefenseStateHash(next));
  });

  it("an absent reserve stays absent after consumption (no fabricated ammunition)", () => {
    const state = makeState(makeSystem(), []);
    const next = consumeAmmunition(state, "sys_001", SafeInt(5));
    expect(next.ammunitionByType.has("sys_001")).toBe(false);
    expect(next).not.toBe(state);
    expect(next.stateHash).toBe(computeAirDefenseStateHash(next));
  });

  it("rejects a negative consumption request (fail-closed)", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(100)]]);
    let caught: unknown;
    try {
      consumeAmmunition(state, "sys_001", -5 as SafeInt);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
  });
});

describe("AC-13: magazine seeding at state construction (Repair MEDIUM-1, §20/§29.21)", () => {
  it("createAirDefenseState seeds each system to its magazineCapacity", () => {
    const system = makeSystem({ magazineCapacity: SafeInt(15) });
    const state = createAirDefenseState(
      "ship_001",
      "SHIP",
      [system],
      directorState(),
      radarState(),
      SafeInt(10_000),
    );
    expect(state.ammunitionByType).toBeInstanceOf(Map);
    expect(state.ammunitionByType.size).toBe(1);
    expect(Number(roundsForSystem(state, "sys_001"))).toBe(15);
    expect(Number(ammunitionMultiplierBp(state, "sys_001"))).toBe(10_000);
  });

  it("repeated engagements drain the seeded magazine to 0, then contribute zero", () => {
    const system = makeSystem({
      magazineCapacity: SafeInt(15),
      roundsPerEngagement: SafeInt(5),
    });
    let state = createAirDefenseState(
      "ship_001",
      "SHIP",
      [system],
      directorState(),
      radarState(),
      SafeInt(10_000),
    );

    state = consumeAmmunition(state, "sys_001");
    expect(Number(roundsForSystem(state, "sys_001"))).toBe(10);
    state = consumeAmmunition(state, "sys_001");
    expect(Number(roundsForSystem(state, "sys_001"))).toBe(5);
    state = consumeAmmunition(state, "sys_001");
    expect(Number(roundsForSystem(state, "sys_001"))).toBe(0);

    expect(hasAmmunition(state, "sys_001")).toBe(false);
    expect(Number(ammunitionMultiplierBp(state, "sys_001"))).toBe(0);
  });
});
