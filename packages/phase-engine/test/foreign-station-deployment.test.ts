import {
  fleetMoveProblem,
  type CampaignSnapshot,
  type CompiledDesignVersion,
  type FleetState,
  type PermanentDivision,
  type Ship,
} from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

const FIXTURE_PRESENCE = {
  colonialServiceDisplacementBp: 137,
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "cruiser",
    nationId: "GBR",
    locationAreaId: "home",
    designVersionId: "d-small",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

const fs = (id: string, over: Partial<Ship> = {}): Ship =>
  ship(id, { stationAssignment: "FOREIGN_STATION", ...over });

function division(id: string, shipOrder: string[], area = "home"): PermanentDivision {
  return {
    divisionId: id,
    nationId: "GBR",
    shipOrder,
    flagshipShipId: shipOrder[0]!,
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: area,
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "0.1.0",
    aggregateHash: "",
  };
}

interface Layout {
  fleets: FleetState[];
  divisions?: PermanentDivision[];
  possessions?: [string, number][];
}

function snapshot(layout: Layout): CampaignSnapshot {
  const possessions = (layout.possessions ?? [["india", 1]]).flatMap(([areaId, n]) =>
    Array.from({ length: n }, (_, i) => ({ id: `p-${areaId}-${i}`, nationId: "GBR", areaId })),
  );
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "deploy",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: {
      areas: [
        { id: "home", name: "home", type: "sea" },
        { id: "mid", name: "mid", type: "sea" },
        { id: "india", name: "india", type: "coastal" },
        { id: "cape", name: "cape", type: "coastal" },
        { id: "island", name: "island", type: "sea" },
        { id: "shore", name: "shore", type: "land" },
      ],
      routes: [
        { id: "r1", from: "home", to: "mid", type: "sea", distance: SafeInt(10) },
        { id: "r2", from: "mid", to: "india", type: "sea", distance: SafeInt(10) },
        { id: "r3", from: "cape", to: "mid", type: "sea", distance: SafeInt(10) },
        { id: "r4", from: "home", to: "shore", type: "sea", distance: SafeInt(10) },
      ],
      ports: [],
      possessions,
    },
    nations: new Map([
      [
        "GBR",
        {
          prestige: SafeInt(20),
          id: "GBR",
          name: "GBR",
          tag: "GBR",
          treasury: SafeInt(10000),
          income: SafeInt(100),
          expenses: SafeInt(0),
          baseResources: SafeInt(0),
          navalAppropriationRateBp: SafeInt(2000),
          maintenanceCost: SafeInt(0),
          fleets: layout.fleets,
          divisions: layout.divisions ?? [],
          research: {
            nationId: "GBR",
            technologies: [],
            fieldPriorities: {},
            researchBudget: SafeInt(0),
            activeCandidates: new Map(),
            discoveredTechs: [],
          },
          constructionProjects: [],
          isPlayable: true,
          isAI: false,
        },
      ],
    ]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([
      [
        "d-small",
        {
          designVersionId: "d-small",
          normalizedDisplacementKg: SafeInt(100_000),
        } as CompiledDesignVersion,
      ],
      [
        "d-big",
        {
          designVersionId: "d-big",
          normalizedDisplacementKg: SafeInt(1_000_000),
        } as CompiledDesignVersion,
      ],
    ]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

const fleet = (id: string, ships: Ship[], area = "home"): FleetState => ({
  id,
  nationId: "GBR",
  name: id,
  locationAreaId: area,
  ships,
});

function run(
  from: CampaignSnapshot,
  withSection = true,
  commands: CommandEnvelope<CommandBody>[] = [],
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    from,
    commands,
    "deploy-seed",
    collector,
    undefined,
    withSection ? { presence: FIXTURE_PRESENCE } : undefined,
  );
  return { result, collector };
}

const gbr = (s: CampaignSnapshot) => s.nations.get("GBR")!;
const shipAt = (s: CampaignSnapshot, id: string) =>
  gbr(s)
    .fleets.flatMap((f) => f.ships)
    .find((x) => x.id === id)!.locationAreaId;
const kinds = (r: ReturnType<typeof run>["result"], kind: string) =>
  r.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body);

describe("S-5 07: foreign-station deployment", () => {
  it("moves exactly one hop per month and reaches the shortfall area over successive months", () => {
    let s = snapshot({ fleets: [fleet("f1", [fs("fs1")])] });
    const path: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      s = run(s).result.finalSnapshot;
      path.push(shipAt(s, "fs1"));
    }
    expect(path).toEqual(["mid", "india", "india", "india"]);
  });

  it("goes to the largest shortfall, breaking ties by ascending area id", () => {
    const larger = snapshot({
      fleets: [fleet("f1", [fs("fs1")])],
      possessions: [
        ["india", 1],
        ["cape", 2],
      ],
    });
    const twice = run(run(larger).result.finalSnapshot).result.finalSnapshot;
    expect(shipAt(twice, "fs1")).toBe("cape");

    const tied = snapshot({
      fleets: [fleet("f1", [fs("fs1")])],
      possessions: [
        ["india", 1],
        ["cape", 1],
      ],
    });
    const result = run(run(tied).result.finalSnapshot).result.finalSnapshot;
    expect(shipAt(result, "fs1")).toBe("cape");
    expect(kinds(run(tied).result, "ForeignStationShipMoved")).toEqual([
      expect.objectContaining({ targetAreaId: "cape", toAreaId: "mid" }),
    ]);
  });

  it("leaves a ship in a shortfall area, a ship with no shortfall anywhere, an unassigned ship, and a dormant ruleset alone", () => {
    const inShort = snapshot({
      fleets: [fleet("f1", [fs("fs1", { locationAreaId: "india" })], "india")],
    });
    expect(shipAt(run(inShort).result.finalSnapshot, "fs1")).toBe("india");

    const covered = snapshot({
      fleets: [
        fleet("f1", [fs("fs1")]),
        fleet("f2", [ship("big", { designVersionId: "d-big", locationAreaId: "india" })], "india"),
      ],
    });
    expect(shipAt(run(covered).result.finalSnapshot, "fs1")).toBe("home");

    const unassigned = snapshot({ fleets: [fleet("f1", [ship("plain")])] });
    expect(shipAt(run(unassigned).result.finalSnapshot, "plain")).toBe("home");

    const demand = snapshot({ fleets: [fleet("f1", [fs("fs1")])] });
    const dormant = run(demand, false).result;
    expect(shipAt(dormant.finalSnapshot, "fs1")).toBe("home");
    expect(kinds(dormant, "ForeignStationShipMoved")).toEqual([]);
  });

  it("does not move a ship whose nation is at war and blockaded (no shortfall is computed)", () => {
    const base = snapshot({ fleets: [fleet("f1", [fs("fs1")])] });
    const blockaded: CampaignSnapshot = {
      ...base,
      wars: {
        ...base.wars,
        wars: [
          {
            id: "w1",
            attackerSideId: "a",
            defenderSideId: "d",
            attackerSideMembers: ["FRA"],
            defenderSideMembers: ["GBR"],
            attackerWarScore: 0,
            defenderWarScore: 0,
            attackerId: "FRA",
            defenderId: "GBR",
            startDate: "1880-01",
            status: "ACTIVE",
          },
        ],
        blockadeState: [
          {
            blockaderId: "FRA",
            blockadedNationId: "GBR",
            areaId: "india",
            establishedMonth: "1880-01",
          },
        ],
      },
    };
    expect(shipAt(run(blockaded).result.finalSnapshot, "fs1")).toBe("home");
  });

  it("detaches only the assigned ship into a single-ship fleet with a typed event", () => {
    const s = snapshot({ fleets: [fleet("f1", [ship("keep"), fs("fs1"), ship("keep2")])] });
    const r = run(s).result;
    const fleets = gbr(r.finalSnapshot).fleets;
    expect(fleets.map((f) => [f.id, f.locationAreaId, f.ships.map((x) => x.id)])).toEqual([
      ["f1", "home", ["keep", "keep2"]],
      ["fleet-fs-fs1", "mid", ["fs1"]],
    ]);
    expect(shipAt(r.finalSnapshot, "keep")).toBe("home");
    expect(kinds(r, "ShipDetachedToFleet")).toEqual([
      {
        kind: "ShipDetachedToFleet",
        nationId: "GBR",
        shipId: "fs1",
        fromFleetId: "f1",
        toFleetId: "fleet-fs-fs1",
        areaId: "home",
      },
    ]);
    const second = run(r.finalSnapshot).result;
    expect(kinds(second, "ShipDetachedToFleet")).toEqual([]);
    expect(
      gbr(second.finalSnapshot).fleets.find((f) => f.id === "fleet-fs-fs1")!.locationAreaId,
    ).toBe("india");
  });

  it("moves a ship that sails alone without creating a new fleet", () => {
    const r = run(snapshot({ fleets: [fleet("f1", [fs("fs1")])] })).result;
    expect(gbr(r.finalSnapshot).fleets.map((f) => [f.id, f.locationAreaId])).toEqual([
      ["f1", "mid"],
    ]);
    expect(kinds(r, "ShipDetachedToFleet")).toEqual([]);
  });

  it("removes the ship from its division and keeps the division valid, with a typed event", () => {
    const s = snapshot({
      fleets: [fleet("f1", [fs("fs1"), ship("b"), ship("c")])],
      divisions: [division("d1", ["fs1", "b", "c"])],
    });
    const r = run(s).result;
    const d = gbr(r.finalSnapshot).divisions;
    expect(d.map((x) => [x.divisionId, x.shipOrder, x.flagshipShipId])).toEqual([
      ["d1", ["b", "c"], "b"],
    ]);
    expect(kinds(r, "ShipRemovedFromDivision")).toEqual([
      {
        kind: "ShipRemovedFromDivision",
        nationId: "GBR",
        shipId: "fs1",
        divisionId: "d1",
        divisionDissolved: false,
        reason: "FOREIGN_STATION_DEPLOYMENT",
      },
    ]);
  });

  it("dissolves a division whose only ship leaves (DESIGN-26: removing the final ship dissolves it)", () => {
    const s = snapshot({
      fleets: [fleet("f1", [fs("fs1")])],
      divisions: [division("d1", ["fs1"])],
    });
    const r = run(s).result;
    expect(gbr(r.finalSnapshot).divisions).toEqual([]);
    expect(kinds(r, "ShipRemovedFromDivision")).toEqual([
      expect.objectContaining({ divisionId: "d1", divisionDissolved: true }),
    ]);
  });

  it("emits a typed no-route event and leaves the ship when no sea path reaches the target", () => {
    const s = snapshot({
      fleets: [fleet("f1", [fs("fs1", { locationAreaId: "island" })], "island")],
    });
    const r = run(s).result;
    expect(shipAt(r.finalSnapshot, "fs1")).toBe("island");
    expect(kinds(r, "ForeignStationNoRoute")).toEqual([
      {
        kind: "ForeignStationNoRoute",
        nationId: "GBR",
        shipId: "fs1",
        areaId: "island",
        targetAreaId: "india",
      },
    ]);
    expect(kinds(r, "ShipDetachedToFleet")).toEqual([]);
  });

  it("is deterministic: the same input gives the same snapshot and event hashes", () => {
    const s = snapshot({
      fleets: [fleet("f1", [fs("fs1"), ship("b")])],
      divisions: [division("d1", ["fs1", "b"])],
    });
    const hashes = () => {
      const r = run(s).result;
      return [sha256Hex(canonicalSerialize(r.finalSnapshot)), r.eventLedger.hash()];
    };
    expect(hashes()).toEqual(hashes());
  });
});

describe("S-5 07: MoveFleet on a fleet holding a foreign-station ship", () => {
  const stationed = snapshot({ fleets: [fleet("f1", [fs("fs1"), ship("b")])] });
  const move = (s: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
    commandId: "mv",
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(s)),
    idempotencyKey: "ik-mv",
    timestamp: "test",
    body: { type: "MoveFleet", nationId: "GBR", fleetId: "f1", toAreaId: "mid" },
  });

  it("is rejected with a typed reason, and allowed once the assignment is cleared", () => {
    expect(fleetMoveProblem(stationed, "GBR", "f1", "mid")?.code).toBe("FOREIGN_STATION_ASSIGNED");
    const cleared = snapshot({ fleets: [fleet("f1", [ship("fs1"), ship("b")])] });
    expect(fleetMoveProblem(cleared, "GBR", "f1", "mid")).toBeNull();
  });

  it("is refused by the month, leaving the fleet where it is", () => {
    const { result, collector } = run(stationed, false, [move(stationed)]);
    expect(shipAt(result.finalSnapshot, "b")).toBe("home");
    expect(
      JSON.stringify([collector.all, result.commandLedger.all ?? result.commandLedger]),
    ).toContain("FOREIGN_STATION_ASSIGNED");
  });

  it("clearing the assignment (command) leaves the ship where it is", () => {
    const afterMove = run(snapshot({ fleets: [fleet("f1", [fs("fs1")])] })).result.finalSnapshot;
    expect(shipAt(afterMove, "fs1")).toBe("mid");
    const clear: CommandEnvelope<CommandBody> = {
      commandId: "clr",
      version: "0.1.0",
      expectedSnapshotHash: sha256Hex(canonicalSerialize(afterMove)),
      idempotencyKey: "ik-clr",
      timestamp: "test",
      body: { type: "ClearForeignStation", nationId: "GBR", shipIds: ["fs1"] },
    };
    const cleared = run(afterMove, true, [clear]).result.finalSnapshot;
    expect(shipAt(cleared, "fs1")).toBe("mid");
    expect(
      gbr(cleared)
        .fleets.flatMap((f) => f.ships)
        .find((x) => x.id === "fs1")!.stationAssignment,
    ).toBeUndefined();
  });
});
