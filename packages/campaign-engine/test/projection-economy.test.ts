import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildPlayerProjection } from "../src/projection.js";
import {
  baseFor,
  fixtureCatalogue,
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

  it("derives researchSpend as the budget the engine will pay, and explains an unpaid one", () => {
    const research = {
      nationId: "uk",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(150),
      activeCandidates: new Map(),
      discoveredTechs: [],
    };
    const uk = fixtureNation({ id: "uk", baseResources: baseFor(2000), research });
    const month = { month: 1, year: 1880 };

    const paid = buildPlayerProjection(
      fixtureState(
        fixtureSnapshot([uk], [], {
          world: { areas: [], routes: [], ports: [], technologies: fixtureCatalogue },
        }),
      ),
      "uk",
      month,
    );
    expect(paid?.economy.researchSpend).toBe(150);
    expect(paid?.economy.researchRequested).toBe(150);
    expect(paid?.economy.researchCap).toBe(240); // floor(12% x 2000)
    expect(paid?.economy.researchUnfundedReason).toBeUndefined();

    // No field can take it: nothing is paid, and the player is told why.
    const unpaid = buildPlayerProjection(fixtureState(fixtureSnapshot([uk])), "uk", month);
    expect(unpaid?.economy.researchSpend).toBe(0);
    expect(unpaid?.economy.researchRequested).toBe(150);
    expect(unpaid?.economy.researchUnfundedReason).toBe("NO_ELIGIBLE_RESEARCH_FIELD");
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
    // revenue 1000 (base 60_000 at 2000bp); two ships of hitPoints 100 and 60 =>
    // floor(1000/100)=10 + floor(600/100)=6 = 16 maintenance; obligations 40;
    // researchBudget 30. Paid work 120+80 = 200 is a stock and enters no monthly net.
    const uk = fixtureNation({
      id: "uk",
      name: "United Kingdom",
      income: SafeInt(1000),
      baseResources: baseFor(1000),
      expenses: SafeInt(40),
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

    const projection = buildPlayerProjection(
      fixtureState(
        fixtureSnapshot([uk], [], {
          world: { areas: [], routes: [], ports: [], technologies: fixtureCatalogue },
        }),
      ),
      "uk",
      {
        month: 1,
        year: 1880,
      },
    );
    if (!projection) throw new Error("expected a projection");

    const revenue = 1000;
    const obligations = 40;
    const fleetMaintenance = 16;
    const research = 30;
    const expected = revenue - obligations - fleetMaintenance - research;
    expect(projection.projectedSurplusDeficit).toBe(expected); // 1000 - 40 - 16 - 30 = 914
    expect(projection.economy.projectedNet).toBe(expected);
    expect(projection.economy.obligations).toBe(obligations);

    // Maintenance must be re-derived from ships, not the raw (0) value.
    expect(projection.projectedSurplusDeficit).not.toBe(revenue - obligations - 0 - research);
  });

  it("is deterministic: identical inputs yield identical projection values", () => {
    const build = () => {
      const uk = fixtureNation({
        id: "uk",
        name: "United Kingdom",
        income: SafeInt(1000),
        baseResources: baseFor(1000),
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
      return buildPlayerProjection(
        fixtureState(
          fixtureSnapshot([uk], [], {
            world: { areas: [], routes: [], ports: [], technologies: fixtureCatalogue },
          }),
        ),
        "uk",
        { month: 1, year: 1880 },
      );
    };

    const a = build();
    const b = build();
    expect(a).toEqual(b);
    expect(a?.economy.constructionSpend).toBe(90);
    expect(a?.economy.researchSpend).toBe(25);
    expect(a?.projectedSurplusDeficit).toBe(1000 - 10 - 25); // 965; the 90 paid so far is a stock
  });
});
