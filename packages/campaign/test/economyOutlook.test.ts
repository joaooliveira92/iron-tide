import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { colonyIncomeForNation, type ColonyIncomeRules } from "../src/colonyIncome.js";
import { constructionDrawByProject, economyOutlook } from "../src/economyOutlook.js";
import type { CampaignSnapshot, ConstructionProject, NationState } from "../src/state.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import type { AccelerationTerms } from "@bluewave/ship-design";

const ACCELERATION_TERMS: AccelerationTerms = {
  workMultiplierBp: 10_500,
  timeBp: 9_000,
  pressureWeightBp: 12_500,
  delayThresholdBp: 9_000,
  delayProbabilityCapBp: 5_000,
  poolMultipleBp: 30_000,
};

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

  it("counts research at full value up to 10% of revenue and applies the curve above it", () => {
    const withBudget = (
      budget: number,
      returns?: { fullReturnShareBp: number; aboveMarginalBp: number },
    ) =>
      economyOutlook(
        snapshot(
          nation({
            research: {
              researchBudget: SafeInt(budget),
              standingResearchBudget: SafeInt(budget),
            },
          }),
        ),
        "n",
        returns === undefined ? {} : { researchReturns: returns },
      )!;
    const curve = { fullReturnShareBp: 1000, aboveMarginalBp: 5000 };
    expect(withBudget(12).researchEffective).toBe(12);
    expect(withBudget(10, curve).researchEffective).toBe(10);
    expect(withBudget(12, curve).researchEffective).toBe(11);
    expect(withBudget(12, curve).plannedResearch).toBe(12);
    expect(withBudget(12, { ...curve, aboveMarginalBp: 10_000 }).researchEffective).toBe(12);
  });

  it("counts only the research the treasury actually pays when the treasury is short", () => {
    const o = economyOutlook(
      snapshot(
        nation({
          treasury: SafeInt(0),
          expenses: SafeInt(80),
          research: { researchBudget: SafeInt(12), standingResearchBudget: SafeInt(12) },
        }),
      ),
      "n",
      { researchReturns: { fullReturnShareBp: 1000, aboveMarginalBp: 5000 } },
    )!;
    expect(o.plannedResearch).toBe(12);
    expect(o.settlement.researchPaid).toBe(4);
    expect(o.researchEffective).toBe(4);
  });

  it("plans only what the phase funds: paced projects, not held, foreign or unpaced new orders", () => {
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
      { acceleration: ACCELERATION_TERMS },
    )!;
    expect(o.constructionDraws).toEqual([{ projectId: "f", draw: 11 }]);
    expect(o.plannedConstruction).toBe(11);
    expect(o.monthEndTreasury).toBe(500 + 41 - 11);
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

describe("constructionDrawByProject", () => {
  it("lists what each live project can absorb this month and skips held and foreign projects", () => {
    const n = nation({
      constructionProjects: [
        project({ id: "live" }),
        project({ id: "halted", status: "HALTED" }),
        project({ id: "foreign", foreignContractId: "fc" }),
      ],
    });
    const draw = constructionDrawByProject(n, snapshot(n), "1880-01");
    expect(draw.map((d) => [d.projectId, d.draw])).toEqual([["live", 40]]);
  });
});

describe("economyOutlook with halted projects", () => {
  const halted = (id: string) => project({ id, status: "HALTED" });

  it("charges each halted project's carrying cost before anything else", () => {
    const n = nation({ constructionProjects: [halted("h1"), halted("h2")] });
    const without = economyOutlook(snapshot(n), "n")!;
    const carried = economyOutlook(snapshot(n), "n", { carryingCostPerHaltedProject: 20 })!;
    expect(without.monthEndTreasury - carried.monthEndTreasury).toBe(40);
    expect(carried.shortfall).toBe(0);
    expect(carried.projectedNet).toBe(without.projectedNet);
  });

  it("leaves less room for construction once carrying costs are paid", () => {
    const live = project({ id: "live" });
    const n = nation({
      treasury: SafeInt(0),
      constructionProjects: [live, halted("h1")],
    });
    const free = economyOutlook(snapshot(n), "n")!;
    const carried = economyOutlook(snapshot(n), "n", { carryingCostPerHaltedProject: 30 })!;
    expect(free.plannedConstruction).toBe(carried.plannedConstruction);
    expect(carried.monthEndTreasury).toBeLessThan(free.monthEndTreasury);
  });

  it("counts an unpayable carrying cost as shortfall, and reports unpaid obligations on their own", () => {
    const n = nation({ treasury: SafeInt(10), constructionProjects: [halted("h1")] });
    const o = economyOutlook(snapshot(n), "n", { carryingCostPerHaltedProject: 500 })!;
    expect(o.shortfall).toBeGreaterThan(0);
    expect(o.obligationShortfall).toBe(38);
    const calm = economyOutlook(snapshot(nation({})), "n")!;
    expect(calm.obligationShortfall).toBe(0);
  });
});

describe("economyOutlook with colony income", () => {
  const colonyRules: ColonyIncomeRules = {
    baselineYear: 1880,
    startFactorBp: 10_000,
    slopeBpPerYear: 120,
    floorBp: 2_500,
  };

  function withPossessions(values: readonly number[], n: NationState): CampaignSnapshot {
    const base = snapshot(n);
    return {
      ...base,
      world: {
        ...base.world,
        possessions: values.map((value, index) => ({
          id: `p${String(index)}`,
          nationId: "n",
          areaId: `a${String(index)}`,
          colonyValueBp: SafeInt(value),
        })),
      },
    };
  }

  it("adds nothing without a ruleset section or without values", () => {
    const plain = economyOutlook(snapshot(nation({})), "n")!;
    const noRules = economyOutlook(withPossessions([100], nation({})), "n")!;
    const noValues = economyOutlook(snapshot(nation({})), "n", { colonyIncome: colonyRules })!;
    expect(noRules).toEqual(plain);
    expect(noValues).toEqual(plain);
    expect(plain.colonyIncome).toBeUndefined();
  });

  it("projects the month-end treasury the phase will credit", () => {
    const snap = withPossessions([100, 50], nation({}));
    const plain = economyOutlook(snap, "n")!;
    const step = colonyIncomeForNation(
      colonyRules,
      snap.world.possessions ?? [],
      "n",
      SafeInt(6000),
      "1880-01",
    )!;
    expect(step.amount as number).toBeGreaterThan(0);
    const o = economyOutlook(snap, "n", { colonyIncome: colonyRules })!;
    expect(o.colonyIncome).toBe(step.amount as number);
    expect(o.monthEndTreasury).toBe(plain.monthEndTreasury + (step.amount as number));
    expect(o.revenue).toBe(plain.revenue);
    expect(o.projectedNet).toBe(plain.projectedNet + (step.amount as number));
  });

  it("lets colony income cover an outflow the treasury alone could not", () => {
    const poor = withPossessions([1000], nation({ treasury: SafeInt(0), expenses: SafeInt(1300) }));
    const plain = economyOutlook(poor, "n")!;
    const o = economyOutlook(poor, "n", { colonyIncome: colonyRules })!;
    expect(plain.shortfall).toBeGreaterThan(0);
    expect(o.shortfall).toBeLessThan(plain.shortfall);
  });
});
