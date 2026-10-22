import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { economyOutlook } from "../src/economyOutlook.js";
import type { CampaignSnapshot, ConstructionProject, NationState } from "../src/state.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function ship(hitPoints: number) {
  return {
    id: `s-${String(hitPoints)}`,
    name: "s",
    classId: "ironclad",
    nationId: "n",
    locationAreaId: "a",
    designVersionId: "",
    hitPoints: SafeInt(hitPoints),
    maxHitPoints: SafeInt(hitPoints),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(100),
    constructionTotalWork: SafeInt(100),
    readiness: "ACTIVE" as const,
    crewQuality: SafeInt(100),
  };
}

function project(over: Partial<ConstructionProject>): ConstructionProject {
  return {
    id: "p",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "t",
    designVersionId: "",
    totalWork: SafeInt(100),
    completedWork: SafeInt(60),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: "1880-01",
    ...over,
  };
}

function nation(
  over: Omit<Partial<NationState>, "research"> & { research?: Partial<NationState["research"]> },
): NationState {
  const { research, ...rest } = over;
  return {
    prestige: SafeInt(20),
    id: "n",
    name: "n",
    tag: "N",
    treasury: SafeInt(500),
    income: SafeInt(100),
    expenses: SafeInt(38),
    baseResources: SafeInt(6000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: "f", nationId: "n", name: "f", locationAreaId: "a", ships: [ship(160)] }],
    divisions: [],
    research: {
      nationId: "n",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(5),
      standingResearchBudget: SafeInt(5),
      activeCandidates: new Map(),
      discoveredTechs: [],
      ...research,
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...rest,
  };
}

function snapshot(n: NationState, withCatalogue = true): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(0),
    campaignId: "outlook",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "n", type: "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      ...(withCatalogue
        ? {
            technologies: [
              {
                techId: "mac_compound_engine",
                researchFieldId: "MACHINERY",
                cost: SafeInt(60),
                discoveryWeight: SafeInt(1000),
                prerequisites: [],
                availabilityMonth: SafeInt(0),
              },
            ],
          }
        : {}),
    },
    nations: new Map([["n", n]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

describe("economyOutlook", () => {
  it("returns undefined for an unknown nation", () => {
    expect(economyOutlook(snapshot(nation({})), "ghost")).toBeUndefined();
  });

  it("reads every line from the shared calculators", () => {
    const o = economyOutlook(snapshot(nation({})), "n")!;
    expect(o).toMatchObject({
      revenue: 100,
      obligations: 38,
      maintenance: 16,
      researchRequested: 5,
      plannedResearch: 5,
      researchCap: 12,
      plannedConstruction: 0,
      projectedNet: 41,
      shortfall: 0,
      monthEndTreasury: 500 + 41,
    });
    expect(o.runwayMonths).toBeUndefined();
    expect(o.researchUnfundedReason).toBeUndefined();
  });

  it("explains a standing research budget no field can take, and plans none of it", () => {
    const o = economyOutlook(snapshot(nation({}), false), "n")!;
    expect(o.plannedResearch).toBe(0);
    expect(o.researchUnfundedReason).toBe("NO_ELIGIBLE_RESEARCH_FIELD");
    expect(o.projectedNet).toBe(100 - 38 - 16);
  });

  it("flags a research budget above the 12% cap", () => {
    const o = economyOutlook(
      snapshot(
        nation({ research: { researchBudget: SafeInt(13), standingResearchBudget: SafeInt(13) } }),
      ),
      "n",
    )!;
    expect(o.researchCap).toBe(12);
    expect(o.researchUnfundedReason).toBe("ABOVE_CAP");
  });

  it("bounds planned construction by the shared monthly draw and leaves held projects out", () => {
    const o = economyOutlook(
      snapshot(
        nation({
          constructionProjects: [
            project({ id: "a", capacityUnits: { slipway: SafeInt(2), quay: SafeInt(2) } }),
            project({ id: "b", completedWork: SafeInt(98) }),
            project({ id: "c", status: "HALTED" }),
            project({ id: "d", status: "COMPLETED", completedWork: SafeInt(100) }),
            project({ id: "e", foreignContractId: "fc" }),
            project({
              id: "f",
              status: "ACCELERATED",
              completedWork: SafeInt(0),
              capacityUnits: { slipway: SafeInt(10) },
              packages: [
                {
                  id: "hull",
                  kind: "HULL",
                  line: "slipway",
                  totalWork: SafeInt(100),
                  doneWork: SafeInt(0),
                  dependsOn: [],
                },
              ],
            }),
          ],
        }),
      ),
      "n",
    )!;
    expect(o.plannedConstruction).toBe(53);
    expect(o.monthEndTreasury).toBe(500 + 41 - 53);
  });

  it("reports the runway and the first shortfall of a structural deficit", () => {
    const o = economyOutlook(
      snapshot(
        nation({
          treasury: SafeInt(1),
          baseResources: SafeInt(180),
          expenses: SafeInt(2),
          fleets: [{ id: "f", nationId: "n", name: "f", locationAreaId: "a", ships: [ship(20)] }],
          research: { researchBudget: SafeInt(0), standingResearchBudget: SafeInt(0) },
        }),
      ),
      "n",
    )!;
    expect(o).toMatchObject({ revenue: 3, maintenance: 2, obligations: 2, projectedNet: -1 });
    expect(o.runwayMonths).toBe(1);
    expect(o.shortfall).toBe(0);
    expect(o.monthEndTreasury).toBe(0);
  });

  it("books a shortfall when the treasury cannot cover the month", () => {
    const o = economyOutlook(
      snapshot(
        nation({
          treasury: SafeInt(0),
          baseResources: SafeInt(180),
          expenses: SafeInt(2),
          fleets: [{ id: "f", nationId: "n", name: "f", locationAreaId: "a", ships: [ship(20)] }],
          research: { researchBudget: SafeInt(0), standingResearchBudget: SafeInt(0) },
        }),
      ),
      "n",
    )!;
    expect(o.shortfall).toBe(1);
    expect(o.monthEndTreasury).toBe(0);
  });
});
