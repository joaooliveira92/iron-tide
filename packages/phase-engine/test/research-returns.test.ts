import type { CampaignSnapshot, NationState, ResearchReturnsRules } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

const HULL_ONLY_CATALOGUE = [
  {
    techId: "basic_hull",
    researchFieldId: "HULL_CONSTRUCTION",
    cost: SafeInt(100_000),
    discoveryWeight: SafeInt(10),
    prerequisites: [],
    availabilityMonth: SafeInt(0),
  },
];

const RULES: ResearchReturnsRules = { fullReturnShareBp: 1_000, aboveMarginalBp: 5_000 };

function gbr(standing: number, baseResources = 120_000): NationState {
  return {
    prestige: SafeInt(50),
    id: "GBR",
    name: "GBR",
    tag: "GBR",
    unrest: 0,
    treasury: SafeInt(1_000_000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(baseResources),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [{ techId: "basic_hull", investedPoints: SafeInt(0), completed: false }],
      fieldPriorities: { HULL_CONSTRUCTION: SafeInt(2) },
      researchBudget: SafeInt(standing),
      standingResearchBudget: SafeInt(standing),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function snapshot(nation: NationState): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(5),
    campaignId: "research-returns",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [], technologies: HULL_ONLY_CATALOGUE },
    nations: new Map([["GBR", nation]]),
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

function runMonth(
  standing: number,
  rules: ResearchReturnsRules | undefined,
  baseResources?: number,
) {
  const result = new MonthExecutor().execute(
    snapshot(gbr(standing, baseResources)),
    [],
    "research-returns-seed",
    new DiagnosticCollector(),
    undefined,
    rules === undefined
      ? { playerNationId: "GBR" }
      : { playerNationId: "GBR", researchReturns: rules },
  );
  const paid = result.financialLedger.all
    .filter((entry) => entry.nationId === "GBR" && entry.categoryId === "RESEARCH_EXPENDITURE")
    .map((entry) => Number(entry.debit));
  const nation = result.finalSnapshot.nations.get("GBR");
  const points = (nation?.research.technologies ?? []).reduce(
    (sum, tech) => sum + Number(tech.investedPoints),
    0,
  );
  return { paid, points, treasury: Number(nation?.treasury) };
}

describe("diminishing research returns above 10% of revenue (manual p.16)", () => {
  it("converts spend one for one up to the threshold (revenue 2000, threshold 200)", () => {
    expect(runMonth(180, RULES).points).toBe(180);
  });

  it("counts only half of the spend between 10% and the 12% cap", () => {
    const run = runMonth(240, RULES);
    expect(run.paid).toEqual([240]);
    expect(run.points).toBe(220);
  });

  it("charges the same money with and without the curve; only the points differ", () => {
    const flat = runMonth(240, undefined);
    const curved = runMonth(240, RULES);
    expect(flat.points).toBe(240);
    expect(curved.paid).toEqual(flat.paid);
    expect(curved.treasury).toBe(flat.treasury);
  });

  it("still charges spend whose effective research rounds to zero (revenue 9, budget 1)", () => {
    const flat = runMonth(1, undefined, 540);
    const curved = runMonth(1, RULES, 540);
    expect(flat.paid).toEqual([1]);
    expect(curved.paid).toEqual([1]);
    expect(curved.treasury).toBe(flat.treasury);
    expect(curved.points).toBe(0);
  });

  it("reproduces the linear behaviour when the marginal rate is full", () => {
    expect(runMonth(240, { ...RULES, aboveMarginalBp: 10_000 }).points).toBe(240);
  });
});
