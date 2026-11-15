import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type {
  BlockadeState,
  CampaignSnapshot,
  CompiledDesignVersion,
  FleetState,
  NationState,
  Ship,
} from "../src/index.js";
import {
  presenceAfterOrders,
  type PresenceOrder,
  type PresenceWarningSnapshot,
} from "../src/presenceAfterOrders.js";
import type { PresenceMeasurementRules } from "../src/presenceMeasurement.js";

const RULES: PresenceMeasurementRules = {
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

const MONTH = "1880-03";

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "c",
    nationId: "uk",
    locationAreaId: "india",
    designVersionId: "d-plain",
    hitPoints: SafeInt(10),
    maxHitPoints: SafeInt(10),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function fleetOf(id: string, areaId: string, ships: Ship[]): FleetState {
  return { id, nationId: "uk", name: id, ships, locationAreaId: areaId };
}

function nation(id: string, fleets: FleetState[]): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets,
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function design(id: string, kg: number): CompiledDesignVersion {
  return { designVersionId: id, normalizedDisplacementKg: SafeInt(kg) } as CompiledDesignVersion;
}

function snapshot(
  fleets: FleetState[],
  opts: { blockaded?: boolean } = {},
): PresenceWarningSnapshot {
  const blockadeState: BlockadeState[] = opts.blockaded
    ? [
        {
          blockaderId: "fra",
          blockadedNationId: "uk",
          areaId: "india",
          establishedMonth: "1880-01",
        },
      ]
    : [];
  return {
    nations: new Map([["uk", nation("uk", fleets)]]),
    world: {
      areas: [
        { id: "india", name: "India", type: "sea" },
        { id: "malta", name: "Malta", type: "sea" },
        { id: "home", name: "Home", type: "sea" },
      ],
      routes: [
        { id: "r1", from: "india", to: "malta", type: "sea", distance: SafeInt(1) },
        { id: "r2", from: "malta", to: "home", type: "sea", distance: SafeInt(1) },
      ],
      ports: [],
      possessions: [
        { id: "p1", nationId: "uk", areaId: "india" },
        { id: "p2", nationId: "uk", areaId: "malta" },
      ],
    },
    designs: new Map([
      ["d-plain", design("d-plain", 4_000_000)],
      ["d-colonial", design("d-colonial", 2_000_000)],
    ]),
    wars: {
      wars: opts.blockaded
        ? [
            {
              id: "w1",
              attackerSideId: "a",
              defenderSideId: "d",
              attackerSideMembers: ["fra"],
              defenderSideMembers: ["uk"],
              attackerWarScore: 0,
              defenderWarScore: 0,
              attackerId: "fra",
              defenderId: "uk",
              startDate: "1880-01",
              status: "ACTIVE" as const,
            },
          ]
        : [],
      battles: [],
      participantMemberships: [],
      blockadeState,
      battleManifests: [],
    },
  } as PresenceWarningSnapshot;
}

const run = (s: PresenceWarningSnapshot, orders: readonly PresenceOrder[]) =>
  presenceAfterOrders(s, "uk", orders, RULES, MONTH);

describe("presenceAfterOrders", () => {
  it("warns with the causing order when a fleet sails out of a covered station", () => {
    const s = snapshot([fleetOf("f1", "india", [ship("a")])]);
    const result = run(s, [{ type: "MOVE_FLEET", fleetId: "f1", toAreaId: "malta" }]);
    expect(result.exempt).toBe(false);
    expect(result.warnings).toEqual([
      {
        nationId: "uk",
        areaId: "india",
        requiredTons: 200,
        presentTonsBefore: 4_000,
        presentTonsAfter: 0,
        shortfallBefore: 0,
        shortfallAfter: 200,
        causes: [0],
      },
    ]);
  });

  it("does not warn about a move that covers the destination, and never about an existing shortfall", () => {
    const s = snapshot([fleetOf("f1", "india", [ship("a")])]);
    expect(run(s, []).warnings).toEqual([]);
    const toMalta = run(s, [{ type: "MOVE_FLEET", fleetId: "f1", toAreaId: "malta" }]);
    expect(toMalta.warnings.map((w) => w.areaId)).toEqual(["india"]);
  });

  it("warns when mothballing a ship removes the only cover", () => {
    const plain = snapshot([fleetOf("f1", "india", [ship("a")])]);
    const mothballed = run(plain, [
      { type: "SET_READINESS", shipIds: ["a"], readiness: "MOTHBALLED" },
    ]);
    expect(mothballed.warnings).toEqual([
      expect.objectContaining({
        areaId: "india",
        presentTonsBefore: 4_000,
        presentTonsAfter: 0,
        shortfallAfter: 200,
        causes: [0],
      }),
    ]);
  });

  it("warns when clearing a posting removes a colonial ship's 3/2 weighting and leaves the station short", () => {
    const colonial = ship("c", {
      designVersionId: "d-colonial",
      colonialServiceFitted: true,
      stationAssignment: "FOREIGN_STATION",
      locationAreaId: "malta",
    });
    const tight: PresenceMeasurementRules = { ...RULES, requiredTonsPerPossessionWeight: 1_250 };
    const s = snapshot([fleetOf("f1", "malta", [colonial])]);
    const result = presenceAfterOrders(
      s,
      "uk",
      [{ type: "CLEAR_STATION", shipIds: ["c"] }],
      tight,
      MONTH,
    );
    expect(result.warnings).toEqual([
      expect.objectContaining({
        areaId: "malta",
        requiredTons: 2_500,
        presentTonsBefore: 3_000,
        presentTonsAfter: 2_000,
        shortfallBefore: 0,
        shortfallAfter: 500,
        causes: [0],
      }),
    ]);
  });

  it("attributes each increase to the order that caused it and skips orders the engine would reject", () => {
    const s = snapshot([
      fleetOf("f1", "india", [ship("a")]),
      fleetOf("f2", "malta", [ship("b", { locationAreaId: "malta" })]),
    ]);
    const result = run(s, [
      { type: "MOVE_FLEET", fleetId: "ghost", toAreaId: "home" },
      { type: "SET_READINESS", shipIds: ["b"], readiness: "RESERVE" },
      { type: "SET_READINESS", shipIds: ["a"], readiness: "MOTHBALLED" },
    ]);
    expect(result.warnings.map((w) => [w.areaId, w.causes])).toEqual([
      ["india", [2]],
      ["malta", [1]],
    ]);
  });

  it("treats holding an exercise as presence-neutral for a plain ship", () => {
    const s = snapshot([fleetOf("f1", "india", [ship("a")])]);
    expect(run(s, [{ type: "HOLD_EXERCISE", shipIds: ["a"] }]).warnings).toEqual([]);
  });

  it("returns no warnings for a nation exempt under a blockade", () => {
    const s = snapshot([fleetOf("f1", "india", [ship("a")])], { blockaded: true });
    const result = run(s, [{ type: "SET_READINESS", shipIds: ["a"], readiness: "MOTHBALLED" }]);
    expect(result).toEqual({ exempt: true, warnings: [] });
  });

  it("does not mutate the snapshot", () => {
    const s = snapshot([fleetOf("f1", "india", [ship("a")])]);
    const before = JSON.stringify([...s.nations.entries()]);
    run(s, [{ type: "MOVE_FLEET", fleetId: "f1", toAreaId: "malta" }]);
    expect(JSON.stringify([...s.nations.entries()])).toBe(before);
  });
});
