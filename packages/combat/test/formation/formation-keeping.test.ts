import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { TacticalBattleState, TacticalDivision } from "@bluewave/combat/tactical";
import type { MovementState } from "@bluewave/combat/movement";
import { advanceMinutes, type UnitOrders } from "@bluewave/combat/simulation";
import {
  appendTrackPoint,
  bearingDeg,
  pointAtPathDistance,
  stationPoint,
  validateFormationKeepingRuleset,
  type FormationContext,
  type FormationKeepingRuleset,
} from "@bluewave/combat/formation";
import { buildTestState } from "../simulation/advance.test.js";

const RULESET: FormationKeepingRuleset = {
  columnIntervalUm: 400_000_000,
  abreastIntervalUm: 400_000_000,
  searchLineIntervalUm: 1_200_000_000,
  divisionGapUm: 500_000_000,
  stationToleranceUm: 50_000_000,
  trackCapacity: 1_800,
  catchUpMarginBp: 2_000,
  catchUpFullErrorUm: 400_000_000,
};

const OBSERVATION = "1900-01-01T00:00:00.000Z";
const KNOT_BP = 1_000;

function movement(position: [number, number], heading: number, speedBp: number): MovementState {
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

function division(overrides: Partial<TacticalDivision> = {}): TacticalDivision {
  return {
    tacticalDivisionId: "div-1",
    battleId: "b1",
    sideId: "ATTACKER",
    role: "CORE",
    formation: "LINE_AHEAD",
    orderedTacticalUnitIds: ["f1", "f2", "f3"],
    tacticalFlagshipId: "f1",
    tacticalCommanderId: "commander-1",
    sourcePermanentDivisionIds: [],
    projectionAdjustmentRecords: [],
    campaignAssetProvenanceIds: [],
    temporaryAssetProvenanceIds: [],
    initialExperience: SafeInt(0),
    initialCohesion: SafeInt(0),
    rulesetVersion: "test",
    recordHash: "hash",
    ...overrides,
  };
}

function column(
  overrides: Partial<TacticalDivision> = {},
  headingDeg = 0,
  speedBp = 15 * KNOT_BP,
): TacticalBattleState {
  const base = buildTestState();
  const template = base.units[0]!;
  const ids = ["f1", "f2", "f3"];
  const units = ids.map((id) => ({
    ...template,
    assetId: id,
    campaignShipId: id,
    name: id,
    sideId: "ATTACKER" as const,
  }));
  const movementStates: Record<string, MovementState> = {};
  ids.forEach((id, index) => {
    movementStates[id] = movement([-index * 400_000_000, 0], headingDeg, speedBp);
  });
  return {
    ...base,
    sides: [{ sideId: "ATTACKER", participantIds: ids }],
    forces: { ATTACKER: ids },
    divisions: [division(overrides)],
    units,
    movementStates,
  };
}

function ordersFor(
  headingDeg: number,
  speedBp: number,
  attainable: Record<string, number> = {},
): Record<string, UnitOrders> {
  const orders: Record<string, UnitOrders> = {};
  for (const id of ["f1", "f2", "f3"]) {
    orders[id] = {
      orderedHeading: headingDeg,
      orderedSpeedBp: speedBp,
      attainableMaxBp: attainable[id] ?? 30 * KNOT_BP,
    };
  }
  return orders;
}

function run(
  state: TacticalBattleState,
  orders: Record<string, UnitOrders>,
  formation: FormationContext | undefined,
  minutes = 1,
) {
  return advanceMinutes({
    state,
    minutes,
    observationTime: OBSERVATION,
    orders,
    ...(formation ? { formation } : {}),
  });
}

describe("formation keeping geometry", () => {
  it("keeps a bounded track and finds the point a path distance behind the head", () => {
    let track = { divisionId: "d", points: [] as readonly (readonly [number, number])[] };
    for (let i = 0; i < 10; i++) track = appendTrackPoint(track, [i * 1_000_000, 0], 4);
    expect(track.points).toHaveLength(4);
    expect(track.points[0]).toEqual([6_000_000, 0]);
    expect(pointAtPathDistance(track.points, 2_500_000, 0)).toEqual([6_500_000, 0]);
    expect(pointAtPathDistance(track.points, 3_000_000, 0)).toEqual([6_000_000, 0]);
    expect(pointAtPathDistance(track.points, 5_000_000, 0)).toEqual([4_000_000, 0]);
    expect(pointAtPathDistance([[0, 0]], 3_000_000, 90)).toEqual([0, -3_000_000]);
    expect(pointAtPathDistance([], 1, 0)).toBeUndefined();
  });

  it("reads the intervals from the ruleset and spreads a search line wider than line abreast", () => {
    const base = { ordinal: 2, divisionIndex: 0, leadPosition: [0, 0] as const, leadHeading: 0 };
    expect(stationPoint({ ...base, formation: "LINE_AHEAD" }, RULESET)).toEqual([-800_000_000, 0]);
    expect(stationPoint({ ...base, formation: "LINE_ABREAST" }, RULESET)).toEqual([0, 800_000_000]);
    expect(stationPoint({ ...base, formation: "SEARCH_LINE" }, RULESET)).toEqual([
      0, 2_400_000_000,
    ]);
    expect(stationPoint({ ...base, formation: "LINE_ABREAST", leadHeading: 90 }, RULESET)[0]).toBe(
      -800_000_000,
    );
  });

  it("turns a displacement into an integer bearing in the battle frame", () => {
    expect(bearingDeg(1_000_000_000, 0)).toBe(0);
    expect(bearingDeg(0, 1_000_000_000)).toBe(90);
    expect(bearingDeg(-1_000_000_000, 0)).toBe(180);
    expect(bearingDeg(0, -1_000_000_000)).toBe(270);
  });

  it("rejects a ruleset that is not positive integers or spreads a search line tighter than abreast", () => {
    expect(() => validateFormationKeepingRuleset({ ...RULESET, columnIntervalUm: 0 })).toThrow();
    expect(() =>
      validateFormationKeepingRuleset({ ...RULESET, searchLineIntervalUm: 400_000_000 }),
    ).toThrow();
    expect(() =>
      validateFormationKeepingRuleset({ ...RULESET, catchUpMarginBp: 10_001 }),
    ).toThrow();
    expect(() => validateFormationKeepingRuleset(RULESET)).not.toThrow();
  });
});

describe("formation keeping in the minute pipeline", () => {
  it("leaves a battle untouched when no formation context is supplied", () => {
    const orders = ordersFor(0, 15 * KNOT_BP);
    const without = run(column(), orders, undefined, 2);
    const again = run(column(), orders, undefined, 2);
    expect(without.hashes).toEqual(again.hashes);
    expect(without.results[0]!.formationRecords).toBeUndefined();
    expect(without.results[0]!.formationTracks).toBeUndefined();
  });

  it("records every ship's station per minute and carries the flagship track forward", () => {
    const result = run(column(), ordersFor(0, 15 * KNOT_BP), { ruleset: RULESET }, 2);
    const first = result.results[0]!;
    expect(first.formationRecords?.map((r) => [r.assetId, r.mode, r.offStation])).toEqual([
      ["f1", "FLAGSHIP", false],
      ["f2", "TRACK", false],
      ["f3", "TRACK", false],
    ]);
    const firstTrack = first.formationTracks!["div-1"]!.points.length;
    const secondTrack = result.results[1]!.formationTracks!["div-1"]!.points.length;
    expect(secondTrack).toBeGreaterThan(firstTrack);
    expect(secondTrack).toBeLessThanOrEqual(RULESET.trackCapacity);
  });

  it("is deterministic across identical runs", () => {
    const a = run(column(), ordersFor(90, 15 * KNOT_BP), { ruleset: RULESET }, 4);
    const b = run(column(), ordersFor(90, 15 * KNOT_BP), { ruleset: RULESET }, 4);
    expect(a.hashes).toEqual(b.hashes);
  });

  it("makes a line-ahead follower pass through the flagship's wake when the column turns", () => {
    const result = run(column(), ordersFor(90, 15 * KNOT_BP), { ruleset: RULESET }, 6);
    const flagshipTrack = result.results[5]!.formationTracks!["div-1"]!.points;
    const f2 = result.finalState.movementStates!["f2"]!.position;
    const nearestUm = Math.min(...flagshipTrack.map((p) => Math.hypot(p[0] - f2[0], p[1] - f2[1])));
    expect(nearestUm).toBeLessThan(RULESET.stationToleranceUm);
  });

  it("turns every ship at once when turn together is ordered", () => {
    const orders = ordersFor(90, 15 * KNOT_BP);
    const succession = run(column(), orders, { ruleset: RULESET }, 1);
    const together = run(
      column(),
      orders,
      { ruleset: RULESET, turnTogether: { "div-1": true } },
      1,
    );
    const headingAfter = (r: typeof succession, id: string) =>
      r.finalState.movementStates![id]!.heading;
    expect(headingAfter(together, "f3")).toBe(headingAfter(together, "f1"));
    expect(headingAfter(succession, "f3")).toBeLessThan(headingAfter(succession, "f1"));
    expect(together.results[0]!.formationRecords!.find((r) => r.assetId === "f2")!.mode).toBe(
      "TURN_TOGETHER",
    );
  });

  it("clamps the division to its slowest ship's attainable speed", () => {
    const orders = ordersFor(0, 25 * KNOT_BP, { f3: 18 * KNOT_BP });
    const result = run(column({}, 0, 18 * KNOT_BP), orders, { ruleset: RULESET }, 3);
    const records = result.results[2]!.formationRecords!;
    expect(records.every((r) => r.divisionSpeedBp === 18 * KNOT_BP)).toBe(true);
    const flagship = result.finalState.movementStates!["f1"]!;
    expect(flagship.currentSpeed).toBeLessThanOrEqual(18 * KNOT_BP);
  });

  it("lets a follower behind station exceed the division speed within its own maximum", () => {
    const state = column();
    state.movementStates!["f3"] = movement([-3_000_000_000, 0], 0, 15 * KNOT_BP);
    const result = run(state, ordersFor(0, 15 * KNOT_BP), { ruleset: RULESET }, 1);
    const f3 = result.finalState.movementStates!["f3"]!;
    expect(f3.currentSpeed).toBeGreaterThan(15 * KNOT_BP);
    expect(f3.currentSpeed).toBeLessThanOrEqual(30 * KNOT_BP);
    const record = result.results[0]!.formationRecords!.find((r) => r.assetId === "f3")!;
    expect(record.offStation).toBe(true);
    expect(record.stationErrorM).toBeGreaterThan(0);
  });

  it("gives a ship ordered to its maximum no catch-up margin", () => {
    const state = column({}, 0, 20 * KNOT_BP);
    state.movementStates!["f3"] = movement([-3_000_000_000, 0], 0, 20 * KNOT_BP);
    const orders = ordersFor(0, 20 * KNOT_BP, { f3: 20 * KNOT_BP });
    const result = run(state, orders, { ruleset: RULESET }, 1);
    expect(result.finalState.movementStates!["f3"]!.currentSpeed).toBeLessThanOrEqual(20 * KNOT_BP);
  });

  it("keeps non-line-ahead formations on flagship-relative stations", () => {
    const state = column({ formation: "LINE_ABREAST" });
    const result = run(state, ordersFor(0, 15 * KNOT_BP), { ruleset: RULESET }, 1);
    const modes = result.results[0]!.formationRecords!.map((r) => r.mode);
    expect(modes).toEqual(["FLAGSHIP", "STATION", "STATION"]);
    const f2 = result.finalState.movementStates!["f2"]!;
    expect(f2.position[1]).toBeGreaterThan(0);
  });

  it("rejects an invalid ruleset at the pipeline boundary", () => {
    expect(() =>
      run(column(), ordersFor(0, 0), { ruleset: { ...RULESET, trackCapacity: 0 } }, 1),
    ).toThrow();
  });
});
