import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { UnrestRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { TEST_RESEARCH_CATALOGUE } from "./research-catalogue.helper.js";

const RULES: UnrestRules = {
  sectionVersion: 1,
  referenceRateBp: 2_000,
  spendingStepBp: 500,
  spendingMaxRise: 2,
  spendingMaxCut: 1,
  warOutbreakRelief: 1,
  warDurationMonths: 12,
  warDurationRise: 1,
  blockadeRise: 1,
  defeatRise: 1,
  victoryRelief: 1,
  crampedWarRise: 1,
  crampedBlockadeRise: 1,
  strikeThreshold: 7,
  strikeRateStepBp: 250,
  revolutionThreshold: 9,
  revolutionProbabilityBp: 10_000,
  liberalDemocracyDampingBp: 4_000,
  aftermathUnrest: 5,
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [
      {
        title: "Rule the Waves 3 manual",
        author: "Naval War Simulations / Matrix Games",
        year: 2023,
        page: "62",
        section: "Unrest drivers and brakes",
      },
    ],
    note: "PROVISIONAL test fixture",
  },
};

function gbr(rateBp: number, unrest: number, standing: number): NationState {
  return {
    prestige: SafeInt(50),
    id: "GBR",
    name: "GBR",
    tag: "GBR",
    unrest,
    treasury: SafeInt(1_000_000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(120_000),
    navalAppropriationRateBp: SafeInt(rateBp),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
      ],
      fieldPriorities: { HULL_CONSTRUCTION: SafeInt(2), MACHINERY: SafeInt(4) },
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
    campaignId: "unrest-research-cap",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [], technologies: TEST_RESEARCH_CATALOGUE },
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

function runMonth(from: CampaignSnapshot, rules: UnrestRules | undefined) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    from,
    [],
    "unrest-research-cap-seed",
    collector,
    undefined,
    rules === undefined ? { playerNationId: "GBR" } : { playerNationId: "GBR", unrest: rules },
  );
  const paid = result.financialLedger.all
    .filter((entry) => entry.nationId === "GBR" && entry.categoryId === "RESEARCH_EXPENDITURE")
    .map((entry) => Number(entry.debit));
  return { result, collector, paid };
}

describe("#1016: the 12% research cap follows the appropriation rate", () => {
  it("pays no more than 12% of the monthly revenue at the current rate", () => {
    const { paid, result } = runMonth(snapshot(gbr(1_000, 0, 360)), undefined);
    expect(paid).toEqual([120]);
    const nation = result.finalSnapshot.nations.get("GBR");
    expect(nation?.research.standingResearchBudget).toBe(360);
  });

  it("pays the full standing budget while it sits at or under the cap", () => {
    const { paid } = runMonth(snapshot(gbr(2_000, 0, 240)), undefined);
    expect(paid).toEqual([240]);
  });

  it("shrinks research payment month by month as strikes cut the rate", () => {
    const first = runMonth(snapshot(gbr(2_000, 7, 240)), RULES);
    expect(first.paid).toEqual([240]);
    expect(first.result.finalSnapshot.nations.get("GBR")?.navalAppropriationRateBp).toBe(1_750);

    const second = runMonth(first.result.finalSnapshot, RULES);
    expect(second.paid).toEqual([210]);

    const third = runMonth(second.result.finalSnapshot, RULES);
    expect(third.paid).toEqual([180]);
    const nation = third.result.finalSnapshot.nations.get("GBR");
    expect(nation?.research.standingResearchBudget).toBe(240);
  });

  it("reports the clamp as an info diagnostic naming the nation and the cap", () => {
    const { collector } = runMonth(snapshot(gbr(1_000, 0, 360)), undefined);
    const clamped = collector.all.filter((d) => d.code === "RESEARCH_CLAMPED_TO_CAP");
    expect(clamped).toHaveLength(1);
    expect(clamped[0]?.severity).toBe("info");
    expect(clamped[0]?.message).toContain("GBR");
    expect(clamped[0]?.message).toContain("120");
  });
});
