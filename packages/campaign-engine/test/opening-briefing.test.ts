import { shipMaintenanceCost as campaignShipMaintenanceCost } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildOpeningBriefingProjection, shipMaintenanceCost } from "../src/opening-briefing.js";
import {
  fixtureConstructionProject,
  fixtureDesign,
  fixtureNation,
  fixtureSnapshot,
  fixtureState,
} from "./fixtures.js";

describe("buildOpeningBriefingProjection", () => {
  it("uses the single campaign maintenance formula (parity, S-1 ticket 02)", () => {
    expect(shipMaintenanceCost).toBe(campaignShipMaintenanceCost);
  });

  it("returns undefined for a nation id absent from the snapshot", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk" })]);
    const state = fixtureState(snapshot);
    expect(
      buildOpeningBriefingProjection(state, "atlantis", { month: 1, year: 1880 }),
    ).toBeUndefined();
  });

  it("derives State of the Navy fields from real snapshot data", () => {
    const designBb = fixtureDesign("uk", "design-bb", {
      className: "Majestic class",
      hullType: "battleship",
      normalizedDisplacementKg: SafeInt(15_000_000),
    });
    const designCl = fixtureDesign("uk", "design-cl", {
      className: "Eclipse class",
      hullType: "light_cruiser",
      normalizedDisplacementKg: SafeInt(6_000_000),
    });
    const uk = fixtureNation({
      id: "uk",
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
              designVersionId: "design-bb",
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
            {
              id: "ship-2",
              name: "HMS Eclipse",
              classId: "light_cruiser",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-cl",
              hitPoints: SafeInt(50),
              maxHitPoints: SafeInt(50),
              speed: SafeInt(20),
              firepower: SafeInt(5),
              armor: SafeInt(5),
              isUnderConstruction: false,
              constructionProgress: SafeInt(0),
              constructionTotalWork: SafeInt(0),
              readiness: "ACTIVE",
              crewQuality: SafeInt(100),
            },
            {
              id: "ship-3",
              name: "HMS Blazing",
              classId: "light_cruiser",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-cl",
              hitPoints: SafeInt(50),
              maxHitPoints: SafeInt(50),
              speed: SafeInt(20),
              firepower: SafeInt(5),
              armor: SafeInt(5),
              isUnderConstruction: true,
              constructionProgress: SafeInt(50),
              constructionTotalWork: SafeInt(100),
              readiness: "WORKING_UP",
              crewQuality: SafeInt(0),
            },
          ],
        },
      ],
      constructionProjects: [
        fixtureConstructionProject({
          id: "con-bb",
          type: "ship",
          designVersionId: "design-bb",
          totalWork: SafeInt(1000),
          completedWork: SafeInt(950),
          paidWork: SafeInt(300),
          status: "ACTIVE",
        }),
        fixtureConstructionProject({
          id: "con-built",
          type: "ship",
          designVersionId: "design-cl",
          totalWork: SafeInt(1000),
          completedWork: SafeInt(1000),
          paidWork: SafeInt(100),
          status: "COMPLETED",
        }),
      ],
    });
    const snapshot = fixtureSnapshot([uk], [designBb, designCl], {
      world: {
        areas: [],
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
        ],
      },
    });
    const projection = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection).toBeDefined();
    if (!projection) return;

    // Tallied by hullType-derived label; the two light cruisers (one of them
    // under construction) both count toward the inventory.
    expect(projection.stateOfTheNavy.shipClassCounts).toEqual([
      { label: "battleship", count: 1 },
      { label: "cruiser", count: 2 },
    ]);
    // Ships under construction: only the non-completed ship project counts
    // (the completed one and the fleet's under-construction ship are not in
    // the construction PROJECT queue).
    expect(projection.stateOfTheNavy.shipsUnderConstruction).toBe(1);
    // Most expensive active class: battleship (15000000 kg -> 150 cost) beats
    // the cruisers (60 cost).
    expect(projection.stateOfTheNavy.mostExpensiveActiveClass).toEqual({
      className: "Majestic class",
      projectedCost: 150,
    });
    // Largest available dock = max port level (30).
    expect(projection.stateOfTheNavy.largestDockCapacity).toBe(30);
    expect(projection.stateOfTheNavy.totalMaintenance).toBe(20);
    // Construction committed = total paidWork across projects (300 + 100).
    expect(projection.stateOfTheNavy.constructionCommitted).toBe(400);
  });

  it("derives Treasury fields and the qualitative status from real data", () => {
    const uk = fixtureNation({
      id: "uk",
      income: SafeInt(10_000),
      navalAppropriationRateBp: SafeInt(2_000), // 20%
      research: {
        nationId: "uk",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(500),
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
      fleets: [
        {
          id: "fleet-1",
          nationId: "uk",
          name: "Home Fleet",
          locationAreaId: "area-lon",
          ships: [
            {
              id: "ship-1",
              name: "HMS Big",
              classId: "battleship",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-bb",
              hitPoints: SafeInt(7_000),
              maxHitPoints: SafeInt(7_000),
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
      constructionProjects: [
        fixtureConstructionProject({
          id: "con-1",
          type: "ship",
          paidWork: SafeInt(400),
          status: "ACTIVE",
        }),
      ],
    });
    const snapshot = fixtureSnapshot([uk]);
    const projection = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection).toBeDefined();
    if (!projection) return;

    // governmentAllocation = 10000 * 2000bp / 10000 = 2000.
    expect(projection.treasury.governmentAllocation).toBe(2_000);
    // fleetMaintenance derived from the single 7000-HP ship: floor(7000/10)=700.
    expect(projection.treasury.fleetMaintenance).toBe(700);
    expect(projection.treasury.constructionCommitted).toBe(400);
    expect(projection.treasury.researchExpenditure).toBe(500);
    expect(projection.treasury.projectedSurplus).toBe(2_000 - 700 - 400 - 500);
    // Surplus 400 is < 25% of 2000 (healthy threshold) but >= 0 -> narrow.
    expect(projection.treasury.status).toBe("narrow");
  });

  it("maps deficit surplus to the deficit status", () => {
    const uk = fixtureNation({
      id: "uk",
      income: SafeInt(10_000),
      navalAppropriationRateBp: SafeInt(2_000),
      fleets: [
        {
          id: "fleet-1",
          nationId: "uk",
          name: "Home Fleet",
          locationAreaId: "area-lon",
          ships: [
            {
              id: "ship-1",
              name: "HMS Huge",
              classId: "battleship",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-bb",
              hitPoints: SafeInt(21_000),
              maxHitPoints: SafeInt(21_000),
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
    });
    const snapshot = fixtureSnapshot([uk]);
    const projection = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", {
      month: 1,
      year: 1880,
    });
    // Maintenance 2100 -> surplus 2000 - 2100 = -100, within [-200, 0) -> deficit.
    expect(projection?.treasury.status).toBe("deficit");
  });

  it("derives Foreign Intelligence relations as label + tension only", () => {
    const uk = fixtureNation({ id: "uk" });
    const germany = fixtureNation({ id: "germany" });
    const snapshot = fixtureSnapshot([uk, germany], [], {
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
    const projection = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection?.foreignIntelligence.relations).toEqual([
      { nationId: "germany", name: "germany", relation: "at_war", tension: 10 },
    ]);
  });

  it("triggers each Immediate Concerns category from real snapshot data", () => {
    const designCl = fixtureDesign("uk", "design-cl", {
      className: "Eclipse class",
      hullType: "light_cruiser",
    });
    const uk = fixtureNation({
      id: "uk",
      income: SafeInt(10_000),
      navalAppropriationRateBp: SafeInt(2_000),
      research: {
        nationId: "uk",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(50), // < 10% of 2000 allocation
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
      constructionProjects: [
        fixtureConstructionProject({
          id: "con-bb",
          type: "ship",
          designVersionId: "design-cl",
          totalWork: SafeInt(100),
          completedWork: SafeInt(95), // >= 90% -> near-complete
          paidWork: SafeInt(2_000), // drives the projected surplus negative
          status: "ACTIVE",
        }),
      ],
      fleets: [
        {
          id: "fleet-1",
          nationId: "uk",
          name: "Home Fleet",
          locationAreaId: "area-lon",
          ships: [
            {
              id: "ship-1",
              name: "HMS Eclipse",
              classId: "light_cruiser",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-cl",
              hitPoints: SafeInt(50),
              maxHitPoints: SafeInt(50),
              speed: SafeInt(20),
              firepower: SafeInt(5),
              armor: SafeInt(5),
              isUnderConstruction: false,
              constructionProgress: SafeInt(0),
              constructionTotalWork: SafeInt(0),
              readiness: "ACTIVE",
              crewQuality: SafeInt(100),
            },
          ],
        },
      ],
    });
    const snapshot = fixtureSnapshot([uk], [designCl]);
    const projection = buildOpeningBriefingProjection(fixtureState(snapshot), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection?.immediateConcerns).toEqual([
      { category: "obsolescence", message: expect.stringContaining("capital ship") },
      { category: "budget_shortfall", message: expect.stringContaining("deficit") },
      { category: "near_complete_construction", message: expect.stringContaining("completion") },
      { category: "low_research_spending", message: expect.stringContaining("Research spending") },
    ]);
  });
});
