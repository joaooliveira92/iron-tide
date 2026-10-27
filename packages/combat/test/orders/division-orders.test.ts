import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, KNOTS_TO_UMS, SafeInt, isBluewaveError } from "@bluewave/contracts";
import type { TacticalDivision } from "@bluewave/combat/tactical";
import type { TacticalShipUnit } from "@bluewave/combat/tactical";
import type { MovementState } from "@bluewave/combat/movement";
import {
  DIVISION_ORDER_INVALID,
  DIVISION_ORDER_LEAD_UNKNOWN,
  DIVISION_ORDER_SPEED_PRESET_UNAVAILABLE,
  DIVISION_ORDER_UNKNOWN_DIVISION,
  DIVISION_ORDER_VERSION,
  DIVISION_ORDER_WAYPOINT_POSITION_UNAVAILABLE,
  compileDivisionOrders,
  decodeDivisionOrderSet,
  divisionOrdersFromLegacy,
  type DivisionOrder,
  type DivisionOrderSet,
} from "@bluewave/combat/orders";

function unit(assetId: string, speedKnots = 30): TacticalShipUnit {
  return {
    assetId,
    campaignShipId: assetId,
    sideId: "ATTACKER",
    name: assetId,
    className: "Test",
    designVersionId: "design",
    shipType: "DD",
    displacementKg: SafeInt(1_000_000),
    designedSpeedUms: SafeInt(Math.round(speedKnots * KNOTS_TO_UMS)),
    armorBeltUm: SafeInt(0),
    mainGunsCaliberUm: SafeInt(0),
    mainGunsCount: SafeInt(0),
    crewComplement: SafeInt(100),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "hash",
    provenance: {
      battleAssetId: assetId,
      campaignAssetId: assetId,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "design",
      sourceCompiledDesignHash: "design-hash",
      preBattleStateHash: "pre-hash",
      projectionReason: "test",
      persistenceDisposition: "persistent",
      provenanceHash: "prov",
    },
  };
}

function division(divisionId: string, unitIds: string[]): TacticalDivision {
  return {
    tacticalDivisionId: divisionId,
    battleId: "battle",
    sideId: "ATTACKER",
    role: "CORE",
    formation: "LINE_AHEAD",
    orderedTacticalUnitIds: unitIds,
    tacticalFlagshipId: unitIds[0]!,
    tacticalCommanderId: "VACANT",
    sourcePermanentDivisionIds: [],
    projectionAdjustmentRecords: [],
    campaignAssetProvenanceIds: [],
    temporaryAssetProvenanceIds: [],
    initialExperience: SafeInt(20),
    initialCohesion: SafeInt(30),
    rulesetVersion: "ruleset",
    recordHash: "record",
  };
}

function movement(position: [number, number]): MovementState {
  return {
    position,
    heading: 0,
    orderedSpeed: 0,
    currentSpeed: 0,
    acceleration: 0,
    turningRate: 1_000,
    collisionRadius: 5_000_000,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
  };
}

const base = { orderedHeading: 45, orderedSpeedBp: 30_000 };

function order(
  divisionId: string,
  navigation: DivisionOrder["navigation"],
  speed: DivisionOrder["speed"],
): DivisionOrder {
  return {
    divisionId,
    navigation,
    speed,
    formation: null,
    role: null,
    leadDivisionId: null,
    control: "PLAYER",
    turnTogether: false,
    issuedAtMinute: 7,
  };
}

function set(divisions: DivisionOrder[]): DivisionOrderSet {
  return { version: DIVISION_ORDER_VERSION, divisions };
}

function capture(run: () => unknown): BluewaveError {
  try {
    run();
  } catch (error) {
    if (isBluewaveError(error)) return error;
    throw error;
  }
  throw new Error("expected the call to throw");
}

describe("division order contract", () => {
  it("decodes a strict order set", () => {
    const decoded = decodeDivisionOrderSet({
      version: DIVISION_ORDER_VERSION,
      divisions: [
        {
          divisionId: "div",
          navigation: { kind: "COURSE", headingDeg: 270 },
          speed: { kind: "PRESET", preset: "TWENTY_FIVE" },
          formation: "LINE_AHEAD",
          role: "CORE",
          leadDivisionId: null,
          control: "PLAYER",
          turnTogether: false,
          issuedAtMinute: 3,
        },
      ],
    });
    expect(decoded.divisions).toHaveLength(1);
    expect(decoded.divisions[0]?.navigation).toEqual({ kind: "COURSE", headingDeg: 270 });
  });

  it("rejects excess keys", () => {
    const failure = capture(() =>
      decodeDivisionOrderSet({ version: DIVISION_ORDER_VERSION, divisions: [], extra: true }),
    );
    expect(failure.context.code).toBe(DIVISION_ORDER_INVALID);
  });

  it("rejects a heading outside 0-359 and a percent outside 0-100", () => {
    expect(() =>
      decodeDivisionOrderSet({
        version: DIVISION_ORDER_VERSION,
        divisions: [
          {
            ...order("div", { kind: "COURSE", headingDeg: 360 }, { kind: "PERCENT", percent: 50 }),
          },
        ],
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      decodeDivisionOrderSet({
        version: DIVISION_ORDER_VERSION,
        divisions: [
          {
            ...order("div", { kind: "COURSE", headingDeg: 90 }, { kind: "PERCENT", percent: 101 }),
          },
        ],
      }),
    ).toThrow(BluewaveError);
  });
});

describe("legacy stance conversion", () => {
  it("converts the stance wire shape into one order per division", () => {
    const converted = divisionOrdersFromLegacy(
      {
        divisions: {
          "div-b": { stance: "HOLD", speedPercent: 0 },
          "div-a": { stance: "ENGAGE", speedPercent: 100 },
        },
      },
      [division("div-a", ["u1"]), division("div-b", ["u2"])],
    );
    expect(converted.divisions.map((entry) => entry.divisionId)).toEqual(["div-a", "div-b"]);
    expect(converted.divisions[0]?.navigation).toEqual({ kind: "STANCE", stance: "ENGAGE" });
    expect(converted.divisions[1]?.formation).toBe("LINE_AHEAD");
    expect(converted.divisions[1]?.issuedAtMinute).toBe(0);
  });
});

describe("division order compilation", () => {
  it("reproduces the legacy stance path exactly", () => {
    const units = [unit("u1"), unit("u2")];
    const divisions = [division("div", ["u1", "u2"])];
    const input = {
      units,
      divisions,
      baseOrders: { u1: base, u2: base },
      movement: { u1: movement([0, 0]), u2: movement([0, 0]) },
      pursuit: { u1: { orderedHeading: 10, orderedSpeedBp: 30_000 } },
      headingAway: () => 90,
    };

    const engage = compileDivisionOrders({
      ...input,
      orders: set([
        order("div", { kind: "STANCE", stance: "ENGAGE" }, { kind: "PERCENT", percent: 50 }),
      ]),
    });
    expect(engage.unitOrders.u1).toEqual({ orderedHeading: 10, orderedSpeedBp: 15_000 });
    expect(engage.unitOrders.u2).toEqual({ orderedHeading: 45, orderedSpeedBp: 15_000 });

    const hold = compileDivisionOrders({
      ...input,
      orders: set([
        order("div", { kind: "STANCE", stance: "HOLD" }, { kind: "PERCENT", percent: 50 }),
      ]),
    });
    expect(hold.unitOrders.u1).toEqual({ orderedHeading: 45, orderedSpeedBp: 0 });

    const withdraw = compileDivisionOrders({
      ...input,
      orders: set([
        order("div", { kind: "STANCE", stance: "WITHDRAW" }, { kind: "PERCENT", percent: 50 }),
      ]),
    });
    expect(withdraw.unitOrders.u1).toEqual({ orderedHeading: 90, orderedSpeedBp: 15_000 });
  });

  it("keeps the no-order default at full speed and the pursuit heading", () => {
    const result = compileDivisionOrders({
      orders: set([]),
      units: [unit("u1")],
      divisions: [division("div", ["u1"])],
      baseOrders: { u1: base },
      movement: { u1: movement([0, 0]) },
      pursuit: { u1: { orderedHeading: 10, orderedSpeedBp: 30_000 } },
    });
    expect(result.unitOrders.u1).toEqual({ orderedHeading: 10, orderedSpeedBp: 30_000 });
    expect(result.issues).toEqual([]);
  });

  it("compiles a course with an absolute knot speed", () => {
    const result = compileDivisionOrders({
      orders: set([
        order("div", { kind: "COURSE", headingDeg: 270 }, { kind: "KNOTS", knots: 18 }),
      ]),
      units: [unit("u1")],
      divisions: [division("div", ["u1"])],
      baseOrders: { u1: base },
      movement: { u1: movement([0, 0]) },
    });
    expect(result.unitOrders.u1).toEqual({ orderedHeading: 270, orderedSpeedBp: 18_000 });
  });

  it("heads a waypoint order toward the point in the battle frame", () => {
    const result = compileDivisionOrders({
      orders: set([
        order(
          "div",
          { kind: "WAYPOINT", xMetres: 1_000, yMetres: 0, pauseOnArrival: false },
          { kind: "PERCENT", percent: 100 },
        ),
      ]),
      units: [unit("u1")],
      divisions: [division("div", ["u1"])],
      baseOrders: { u1: base },
      movement: { u1: movement([0, 0]) },
    });
    expect(result.unitOrders.u1?.orderedHeading).toBe(0);
    expect(result.unitOrders.u1?.orderedSpeedBp).toBe(30_000);
  });

  it("reports a waypoint it cannot place and keeps the base heading", () => {
    const result = compileDivisionOrders({
      orders: set([
        order(
          "div",
          { kind: "WAYPOINT", xMetres: 1_000, yMetres: 0, pauseOnArrival: false },
          { kind: "PERCENT", percent: 100 },
        ),
      ]),
      units: [unit("u1")],
      divisions: [division("div", ["u1"])],
      baseOrders: { u1: base },
      movement: {},
    });
    expect(result.unitOrders.u1?.orderedHeading).toBe(45);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      DIVISION_ORDER_WAYPOINT_POSITION_UNAVAILABLE,
    ]);
  });

  it("resolves the five speed presets from designed speed", () => {
    const units = [unit("u1", 30), unit("u2", 25)];
    const divisions = [division("div", ["u1", "u2"])];
    const run = (preset: "CRUISE" | "TWENTY" | "TWENTY_FIVE" | "MAX_MINUS_2" | "SQUADRON_MAX") =>
      compileDivisionOrders({
        orders: set([order("div", { kind: "COURSE", headingDeg: 0 }, { kind: "PRESET", preset })]),
        units,
        divisions,
        baseOrders: { u1: base, u2: base },
        movement: { u1: movement([0, 0]), u2: movement([0, 0]) },
        cruiseSpeedBp: 18_000,
      }).unitOrders.u1?.orderedSpeedBp;
    expect(run("CRUISE")).toBe(18_000);
    expect(run("TWENTY")).toBe(20_000);
    expect(run("TWENTY_FIVE")).toBe(25_000);
    expect(run("MAX_MINUS_2")).toBe(28_000);
    expect(run("SQUADRON_MAX")).toBe(25_000);
  });

  it("reports a cruise preset that has no ruleset value", () => {
    const result = compileDivisionOrders({
      orders: set([
        order("div", { kind: "COURSE", headingDeg: 0 }, { kind: "PRESET", preset: "CRUISE" }),
      ]),
      units: [unit("u1")],
      divisions: [division("div", ["u1"])],
      baseOrders: { u1: base },
      movement: { u1: movement([0, 0]) },
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      DIVISION_ORDER_SPEED_PRESET_UNAVAILABLE,
    ]);
    expect(result.unitOrders.u1?.orderedSpeedBp).toBe(30_000);
  });

  it("reports unknown divisions and leads without producing orders for them", () => {
    const result = compileDivisionOrders({
      orders: set([
        order("div", { kind: "COURSE", headingDeg: 0 }, { kind: "PERCENT", percent: 100 }),
        order("ghost", { kind: "COURSE", headingDeg: 0 }, { kind: "PERCENT", percent: 100 }),
        {
          ...order("div-two", { kind: "COURSE", headingDeg: 0 }, { kind: "PERCENT", percent: 100 }),
          leadDivisionId: "missing",
        },
      ]),
      units: [unit("u1"), unit("u2")],
      divisions: [division("div", ["u1"]), division("div-two", ["u2"])],
      baseOrders: { u1: base, u2: base },
      movement: { u1: movement([0, 0]), u2: movement([0, 0]) },
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      DIVISION_ORDER_LEAD_UNKNOWN,
      DIVISION_ORDER_UNKNOWN_DIVISION,
    ]);
  });
});
