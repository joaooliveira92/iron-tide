import type { BattleInstance, CampaignSnapshot, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_FLEET_MANAGEMENT_RULES, FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

function makeShip(nationId: string, id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "battleship",
    nationId,
    locationAreaId: "a-1",
    designVersionId: "",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(200),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function makeNation(id: string, ships: Ship[]) {
  return {
    id,
    name: id,
    tag: id,
    prestige: SafeInt(20),
    treasury: SafeInt(10000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      { id: `fleet-${id}`, nationId: id, name: `${id} Fleet`, locationAreaId: "a-1", ships },
    ],
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
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

function makeSnapshot(gbrShips: Ship[]): CampaignSnapshot {
  const nations = new Map();
  nations.set("GBR", makeNation("GBR", gbrShips));
  nations.set("FRA", makeNation("FRA", [makeShip("FRA", "f1"), makeShip("FRA", "f2")]));
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "battle-absences",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations,
    wars: {
      wars: [
        {
          id: "war_1",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: ["GBR"],
          defenderSideMembers: ["FRA"],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: "GBR",
          defenderId: "FRA",
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "1.0",
    compatibilityVersion: "1.2.0",
  };
}

const ABSENT_FLEET = [
  makeShip("GBR", "g1"),
  makeShip("GBR", "g2"),
  makeShip("GBR", "g_mothballed", { readiness: "MOTHBALLED" }),
  makeShip("GBR", "g_working_up", { readiness: "WORKING_UP", crewQuality: SafeInt(0) }),
  makeShip("GBR", "g_station", { stationAssignment: "FOREIGN_STATION" }),
  makeShip("GBR", "g_elsewhere", { readiness: "RESERVE", locationAreaId: "a-9" }),
  makeShip("GBR", "g_building", { isUnderConstruction: true, readiness: "WORKING_UP" }),
  makeShip("GBR", "g_poor_crew", { crewQuality: SafeInt(0) }),
];

function run(snapshot: CampaignSnapshot, active: boolean): readonly BattleInstance[] {
  const result = new MonthExecutor().execute(
    snapshot,
    [],
    "seed",
    new DiagnosticCollector(),
    undefined,
    {
      playerNationId: "GBR",
      ...(active ? { fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES } : {}),
    },
  );
  return result.finalSnapshot.wars.battles;
}

describe("battle absence record", () => {
  it("lists only candidate ships that fail the enter-battle gates, with ordered reasons", () => {
    const battles = run(makeSnapshot(ABSENT_FLEET), true);
    expect(battles).toHaveLength(1);
    expect(battles[0]!.absences).toEqual([
      { shipId: "g_mothballed", reasons: ["Mothballed"] },
      { shipId: "g_working_up", reasons: ["WorkingUp"] },
    ]);
  });

  it("never lists low crew quality as an absence reason", () => {
    const battles = run(makeSnapshot(ABSENT_FLEET), true);
    const listed = (battles[0]!.absences ?? []).map((a) => a.shipId);
    expect(listed).not.toContain("g_poor_crew");
  });

  it("keeps the recorded reasons after the ship is later repaired", () => {
    const snapshot = makeSnapshot(ABSENT_FLEET);
    const first = new MonthExecutor().execute(
      snapshot,
      [],
      "seed",
      new DiagnosticCollector(),
      undefined,
      { playerNationId: "GBR", fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES },
    );
    const recorded = structuredClone(first.finalSnapshot.wars.battles[0]!.absences);
    const repaired = first.finalSnapshot;
    for (const fleet of repaired.nations.get("GBR")!.fleets) {
      for (const ship of fleet.ships) {
        if (ship.id === "g_working_up") ship.readiness = "ACTIVE";
      }
    }
    const second = new MonthExecutor().execute(
      repaired,
      [],
      "seed-2",
      new DiagnosticCollector(),
      undefined,
      { playerNationId: "GBR", fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES },
    );
    const original = second.finalSnapshot.wars.battles.find(
      (b) => b.id === first.finalSnapshot.wars.battles[0]!.id,
    );
    expect(original?.absences).toEqual(recorded);
  });

  it("records nothing while the fleet-management section is dormant", () => {
    const battles = run(makeSnapshot(ABSENT_FLEET), false);
    expect(battles).toHaveLength(1);
    expect(battles[0]!.absences).toBeUndefined();
  });

  it("omits the field when no candidate is absent", () => {
    const battles = run(makeSnapshot([makeShip("GBR", "g1"), makeShip("GBR", "g2")]), true);
    expect(battles[0]!.absences).toBeUndefined();
  });
});
