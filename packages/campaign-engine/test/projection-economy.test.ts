import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildPlayerProjection } from "../src/projection.js";
import {
  fixtureConstructionProject,
  fixtureNation,
  fixtureSnapshot,
  fixtureState,
} from "./fixtures.js";

describe("buildPlayerProjection — economy + header extension (INC-1)", () => {
  it("derives constructionSpend as the cumulative paidWork across projects, 0 with none", () => {
    const uk = fixtureNation({
      id: "uk",
      name: "United Kingdom",
      constructionProjects: [
        fixtureConstructionProject({ id: "con-1", paidWork: SafeInt(120) }),
        fixtureConstructionProject({ id: "con-2", paidWork: SafeInt(80) }),
        fixtureConstructionProject({ id: "con-3", paidWork: SafeInt(50) }),
      ],
    });
    const projection = buildPlayerProjection(fixtureState(fixtureSnapshot([uk])), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection?.economy.constructionSpend).toBe(250);

    const noProjects = buildPlayerProjection(
      fixtureState(fixtureSnapshot([fixtureNation({ id: "de" })])),
      "de",
      {
        month: 1,
        year: 1880,
      },
    );
    expect(noProjects?.economy.constructionSpend).toBe(0);
  });

  it("derives researchSpend as the direct researchBudget read", () => {
    const uk = fixtureNation({
      id: "uk",
      research: {
        nationId: "uk",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(150),
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
    });
    const projection = buildPlayerProjection(fixtureState(fixtureSnapshot([uk])), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection?.economy.researchSpend).toBe(150);
  });

  it("exposes nationName from the nation's name field", () => {
    const uk = fixtureNation({ id: "uk", name: "United Kingdom of Great Britain" });
    const projection = buildPlayerProjection(fixtureState(fixtureSnapshot([uk])), "uk", {
      month: 1,
      year: 1880,
    });
    expect(projection?.nationName).toBe("United Kingdom of Great Britain");
  });

  it("derives projectedSurplusDeficit from the briefing chain, re-deriving maintenance from ships", () => {
    // income 1000 * 2000bp/10000 = 200 allocation; two ships of hitPoints 100
    // and 60 => floor(1000/100)=10 + floor(600/100)=6 = 16 maintenance; paid
    // work 120+80 = 200 construction; researchBudget 30.
    const uk = fixtureNation({
      id: "uk",
      name: "United Kingdom",
      income: SafeInt(1000),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0), // raw value is 0 pre-first-commit
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
            {
              id: "ship-2",
              name: "HMS Dreadnought",
              classId: "battleship",
              nationId: "uk",
              locationAreaId: "area-lon",
              designVersionId: "design-dreadnought",
              hitPoints: SafeInt(60),
              maxHitPoints: SafeInt(60),
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
        fixtureConstructionProject({ id: "con-1", paidWork: SafeInt(120) }),
        fixtureConstructionProject({ id: "con-2", paidWork: SafeInt(80) }),
      ],
      research: {
        nationId: "uk",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(30),
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
    });

    const projection = buildPlayerProjection(fixtureState(fixtureSnapshot([uk])), "uk", {
      month: 1,
      year: 1880,
    });
    if (!projection) throw new Error("expected a projection");

    const allocation = 200;
    const fleetMaintenance = 16;
    const construction = 200;
    const research = 30;
    const expected = allocation - fleetMaintenance - construction - research;
    expect(projection.projectedSurplusDeficit).toBe(expected); // 200 - 16 - 200 - 30 = -46

    // Maintenance must be re-derived from ships, not the raw (0) value.
    expect(projection.projectedSurplusDeficit).not.toBe(allocation - 0 - construction - research);
  });

  it("is deterministic: identical inputs yield identical projection values", () => {
    const build = () => {
      const uk = fixtureNation({
        id: "uk",
        name: "United Kingdom",
        income: SafeInt(1000),
        navalAppropriationRateBp: SafeInt(2000),
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
        constructionProjects: [fixtureConstructionProject({ id: "con-1", paidWork: SafeInt(90) })],
        research: {
          nationId: "uk",
          technologies: [],
          fieldPriorities: {},
          researchBudget: SafeInt(25),
          activeCandidates: new Map(),
          discoveredTechs: [],
        },
      });
      return buildPlayerProjection(fixtureState(fixtureSnapshot([uk])), "uk", {
        month: 1,
        year: 1880,
      });
    };

    const a = build();
    const b = build();
    expect(a).toEqual(b);
    expect(a?.economy.constructionSpend).toBe(90);
    expect(a?.economy.researchSpend).toBe(25);
    expect(a?.projectedSurplusDeficit).toBe(200 - 10 - 90 - 25); // 75
  });
});
