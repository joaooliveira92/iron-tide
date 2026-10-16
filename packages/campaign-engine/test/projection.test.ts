import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildPlayerProjection } from "../src/projection.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

describe("buildPlayerProjection", () => {
  it("returns undefined for a nation id absent from the snapshot", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk" })]);
    const state = fixtureState(snapshot);
    expect(buildPlayerProjection(state, "atlantis", { month: 1, year: 1880 })).toBeUndefined();
  });

  it("builds a real, non-placeholder projection from the compiled snapshot", () => {
    const uk = fixtureNation({
      id: "uk",
      treasury: SafeInt(50_000),
      income: SafeInt(1_000),
      navalAppropriationRateBp: SafeInt(2_000), // 20%
      fleets: [
        {
          id: "fleet-1",
          nationId: "uk",
          name: "Home Fleet",
          locationAreaId: "area-lon",
          ships: [
            {
              id: "ship-1",
              name: "HMS Majestic",
              classId: "battleship",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-majestic",
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
            },
          ],
        },
      ],
      research: {
        nationId: "uk",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(0),
        activeCandidates: new Map(),
        discoveredTechs: ["tech_steel_hull", "tech_triple_expansion"],
      },
    });
    const germany = fixtureNation({ id: "germany" });

    const snapshot = fixtureSnapshot([uk, germany], [], {
      turnNumber: SafeInt(3),
      world: {
        areas: [
          { id: "area-lon", name: "London", type: "coastal", controller: "uk" },
          { id: "area-ber", name: "Berlin", type: "land", controller: "germany" },
        ],
        routes: [],
        ports: [
          {
            id: "port-portsmouth",
            name: "Portsmouth",
            areaId: "area-lon",
            nationId: "uk",
            level: SafeInt(30),
          },
          {
            id: "port-chatham",
            name: "Chatham",
            areaId: "area-lon",
            nationId: "uk",
            level: SafeInt(20),
          },
          {
            id: "port-kiel",
            name: "Kiel",
            areaId: "area-ber",
            nationId: "germany",
            level: SafeInt(15),
          },
        ],
      },
      politics: {
        relations: [
          {
            nationA: "uk",
            nationB: "germany",
            relation: "at_war",
            tension: 10,
            nap: false,
            since: "1880-01",
          },
        ],
        shells: {},
      },
    });
    const state = fixtureState(snapshot, "raw-hash-abc");

    const projection = buildPlayerProjection(state, "uk", { month: 3, year: 1900 });
    expect(projection).toBeDefined();
    if (!projection) return;

    expect(projection.campaignIdentity).toBe(snapshot.campaignId);
    expect(projection.snapshotHash).toBe("raw-hash-abc");
    expect(projection.revision).toBe(3);
    expect(projection.month).toEqual({ month: 3, year: 1900 });
    expect(projection.playerNationId).toBe("uk");

    // Economy: treasury is direct, monthlyAppropriation reuses the real
    // basis-point scaling formula (1000 * 2000bp/10000 = 200).
    expect(projection.economy.treasury).toBe(50_000);
    expect(projection.economy.monthlyAppropriation).toBe(200);
    // shipyardCapacity is the sum of the nation's own ports' levels (30 + 20).
    expect(projection.economy.shipyardCapacity).toBe(50);

    expect(projection.ports).toEqual([
      { id: "port-chatham", name: "Chatham", areaId: "area-lon", capacity: 20 },
      { id: "port-portsmouth", name: "Portsmouth", areaId: "area-lon", capacity: 30 },
    ]);

    expect(projection.fleet).toEqual([
      {
        name: "Home Fleet",
        divisions: [
          {
            name: "Home Fleet",
            areaId: "area-lon",
            ships: [{ name: "HMS Majestic", designId: "design-majestic" }],
          },
        ],
      },
    ]);

    expect(projection.strategicAreas).toEqual([{ id: "area-lon", name: "London" }]);
    expect(projection.knownTechnologyIds).toEqual(["tech_steel_hull", "tech_triple_expansion"]);
    expect(projection.knownEnemyNations).toEqual(["germany"]);
    expect(projection.commandWorkspace).toEqual({ commands: [], movementCommands: [] });
  });
});
