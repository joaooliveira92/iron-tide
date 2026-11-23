import type { TradeProtectionRules } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { decideTradeDuty } from "../src/tradeDutyBehaviour";

type Snapshot = Parameters<typeof decideTradeDuty>[0];

const RULES: TradeProtectionRules = {
  fleetShareBp: 5000,
  resourcesPerRequiredShip: 100,
  contributingHullTypes: ["destroyer"],
  raiderHullTypes: ["protected_cruiser"],
  amcHullType: "armed_merchant_cruiser",
  amcMinSpeedUms: 4_115_552,
  raiderHitBp: 10_000,
  shortfallAmplifyBp: 5000,
  lossPerHitBp: 1000,
  pressureChanceBp: 10_000,
  pressureLossBp: 500,
  recoveryBpPerMonth: 200,
  revenueSensitivityBp: 5000,
  unrestThresholdBp: 1000,
  unrestCadenceMonths: 1,
  unrestStep: 1,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 10_000,
    attackBp: 1000,
    lossPerHitBp: 500,
    blockadeReductionBp: 5000,
  },
};

const idle = { engaged: true, sortieFleetIds: new Set<string>(), enemyAreas: new Set<string>() };

function ship(id: string, design: string, over: Record<string, unknown> = {}) {
  return {
    id,
    designVersionId: design,
    nationId: "FRA",
    readiness: "ACTIVE",
    isUnderConstruction: false,
    availability: "AVAILABLE",
    locationAreaId: "home",
    ...over,
  };
}

function fleet(id: string, ships: ReturnType<typeof ship>[], over: Record<string, unknown> = {}) {
  return { id, nationId: "FRA", name: id, locationAreaId: "home", ships, ...over };
}

function world(fleets: ReturnType<typeof fleet>[], enemyShips: ReturnType<typeof ship>[]) {
  return {
    nations: new Map([
      ["FRA", { id: "FRA", baseResources: 0, fleets }],
      ["GBR", { id: "GBR", fleets: [fleet("g", enemyShips)] }],
    ]),
    designs: new Map([
      ["dd", { hullType: "destroyer", normalizedSpeedUms: 1 }],
      [
        "dd-asw",
        {
          hullType: "destroyer",
          normalizedSpeedUms: 1,
          capabilities: [{ kind: "asw_attack", level: 2 }],
        },
      ],
      ["bb", { hullType: "battleship", normalizedSpeedUms: 1 }],
      ["cp", { hullType: "protected_cruiser", normalizedSpeedUms: 1 }],
      ["sub", { hullType: "submarine", normalizedSpeedUms: 1 }],
    ]),
  } as Snapshot;
}

const raider = ship("r", "cp", { stationAssignment: "RAIDER" });
const sub = ship("s", "sub");

describe("decideTradeDuty (#1069)", () => {
  it("assigns whole idle contributing fleets until the shortfall is covered, in fleet id order", () => {
    const snapshot = world(
      [
        fleet("b", [ship("b1", "dd"), ship("b2", "dd")]),
        fleet("a", [ship("a1", "dd"), ship("a2", "dd")]),
        fleet("c", [ship("c1", "dd"), ship("c2", "dd")]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle)).toEqual({
      assign: ["a1", "a2", "b1", "b2"],
      release: [],
    });
  });

  it("does nothing when the enemy fields neither a raider nor a submarine", () => {
    const snapshot = world([fleet("a", [ship("a1", "dd")])], [ship("e", "dd")]);
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle)).toEqual({
      assign: [],
      release: [],
    });
  });

  it("counts enemy submarines into the quota and prefers anti-submarine fleets", () => {
    const snapshot = world(
      [fleet("a", [ship("a1", "dd")]), fleet("z", [ship("z1", "dd-asw")])],
      [sub, ship("s2", "sub")],
    );
    const submarinesOnly = { ...RULES, fleetShareBp: 0 };
    expect(decideTradeDuty(snapshot, "FRA", "GBR", submarinesOnly, idle).assign).toEqual([
      "a1",
      "z1",
    ]);
    const single = world(
      [fleet("a", [ship("a1", "dd")]), fleet("z", [ship("z1", "dd-asw")])],
      [sub],
    );
    expect(decideTradeDuty(single, "FRA", "GBR", submarinesOnly, idle).assign).toEqual(["z1"]);
  });

  it("skips fleets that sortie, hold the enemy area, are under way, or carry non-escort hulls", () => {
    const snapshot = world(
      [
        fleet("a", [ship("a1", "dd")]),
        fleet("b", [ship("b1", "dd")], { locationAreaId: "front" }),
        fleet("c", [ship("c1", "dd")], { destinationAreaId: "far" }),
        fleet("d", [ship("d1", "dd"), ship("d2", "bb")]),
        fleet("e", [ship("e1", "dd")]),
      ],
      [raider],
    );
    const decision = decideTradeDuty(snapshot, "FRA", "GBR", RULES, {
      engaged: true,
      sortieFleetIds: new Set(["a"]),
      enemyAreas: new Set(["front"]),
    });
    expect(decision.assign).toEqual(["e1"]);
  });

  it("assigns nothing once the quota is already met", () => {
    const snapshot = world(
      [
        fleet("a", [ship("a1", "dd", { stationAssignment: "TRADE_PROTECTION" })]),
        fleet("b", [ship("b1", "dd")]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle).assign).toEqual([]);
  });

  it("covers a remaining shortfall from idle fleets, not from fleets already on duty", () => {
    const snapshot = world(
      [
        fleet("a", [
          ship("a1", "dd", { stationAssignment: "TRADE_PROTECTION" }),
          ship("a2", "dd", { stationAssignment: "TRADE_PROTECTION" }),
        ]),
        fleet("b", [ship("b1", "dd"), ship("b2", "dd")]),
        fleet("c", [ship("c1", "dd"), ship("c2", "dd")]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle).assign).toEqual(["b1", "b2"]);
  });

  it("releases duty fleets mid-war when the enemy no longer fields a raider or a submarine", () => {
    const duty = { stationAssignment: "TRADE_PROTECTION" };
    const snapshot = world(
      [
        fleet("b", [ship("b2", "dd", duty), ship("b1", "dd", duty)]),
        fleet("a", [ship("a1", "dd", duty)]),
        fleet("c", [ship("c1", "dd")]),
      ],
      [ship("e", "dd")],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle)).toEqual({
      assign: [],
      release: ["a1", "b1", "b2"],
    });
  });

  it("releases surplus whole duty fleets in fleet id order while the quota stays met", () => {
    const duty = { stationAssignment: "TRADE_PROTECTION" };
    const snapshot = world(
      [
        fleet("c", [ship("c1", "dd", duty), ship("c2", "dd", duty)]),
        fleet("a", [ship("a1", "dd", duty), ship("a2", "dd", duty)]),
        fleet("b", [ship("b1", "dd", duty), ship("b2", "dd", duty)]),
        fleet("d", [ship("d1", "dd"), ship("d2", "dd")]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle)).toEqual({
      assign: [],
      release: ["a1", "a2"],
    });
  });

  it("keeps duty fleets whose release would leave the quota unmet", () => {
    const duty = { stationAssignment: "TRADE_PROTECTION" };
    const snapshot = world(
      [
        fleet("a", [ship("a1", "dd", duty), ship("a2", "dd", duty)]),
        fleet("b", [ship("b1", "dd", duty), ship("b2", "dd", duty)]),
        fleet("c", [ship("c1", "dd"), ship("c2", "dd")]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle)).toEqual({
      assign: [],
      release: [],
    });
  });

  it("does not release a fleet that mixes duty and idle ships as surplus", () => {
    const duty = { stationAssignment: "TRADE_PROTECTION" };
    const snapshot = world(
      [
        fleet("a", [ship("a1", "dd", duty), ship("a2", "dd")]),
        fleet("b", [ship("b1", "dd", duty), ship("b2", "dd", duty)]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, idle).release).toEqual([]);
  });

  it("keeps the anti-submarine fleet on duty when the only quota-safe release is that fleet (#1094)", () => {
    const duty = { stationAssignment: "TRADE_PROTECTION" };
    const snapshot = world(
      [
        fleet("z", [ship("z1", "dd-asw", duty)]),
        fleet("a", [ship("a1", "dd", duty), ship("a2", "dd", duty), ship("a3", "dd", duty)]),
      ],
      [sub, ship("s2", "sub")],
    );
    const submarinesOnly = { ...RULES, fleetShareBp: 0 };
    expect(decideTradeDuty(snapshot, "FRA", "GBR", submarinesOnly, idle)).toEqual({
      assign: [],
      release: [],
    });
  });

  it("releases plain surplus fleets before anti-submarine fleets while submarines are present (#1094)", () => {
    const duty = { stationAssignment: "TRADE_PROTECTION" };
    const snapshot = world(
      [
        fleet("a", [ship("a1", "dd-asw", duty)]),
        fleet("b", [ship("b1", "dd", duty)]),
        fleet("c", [ship("c1", "dd", duty), ship("c2", "dd", duty)]),
      ],
      [sub, ship("s2", "sub")],
    );
    const submarinesOnly = { ...RULES, fleetShareBp: 0 };
    expect(decideTradeDuty(snapshot, "FRA", "GBR", submarinesOnly, idle)).toEqual({
      assign: [],
      release: ["b1"],
    });
  });

  it("releases escorts when no war is engaged", () => {
    const snapshot = world(
      [
        fleet("a", [
          ship("a2", "dd", { stationAssignment: "TRADE_PROTECTION" }),
          ship("a1", "dd", { stationAssignment: "TRADE_PROTECTION" }),
          ship("a3", "dd"),
        ]),
      ],
      [raider],
    );
    expect(decideTradeDuty(snapshot, "FRA", "GBR", RULES, { ...idle, engaged: false })).toEqual({
      assign: [],
      release: ["a1", "a2"],
    });
  });
});
