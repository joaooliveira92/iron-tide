import type { CampaignSnapshot, NationState, Ship, WarState } from "@bluewave/campaign";
import type { GovernmentType, UnrestRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, monthPipeline } from "../src/index.js";

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
  governmentAfterRevolution: {
    liberal_democracy: "communist",
    limited_democracy: "fascist",
    autocratic: "communist",
    fascist: "limited_democracy",
    communist: "autocratic",
    eastern: "limited_democracy",
  },
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

function ship(designVersionId: string): Ship {
  return {
    id: "s1",
    name: "s1",
    classId: "cruiser",
    nationId: "GBR",
    locationAreaId: "a-1",
    designVersionId,
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(100),
    constructionTotalWork: SafeInt(100),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
  };
}

function nation(id: string, rateBp: number, unrest: number | undefined): NationState {
  return {
    prestige: SafeInt(50),
    id,
    name: id,
    tag: id,
    ...(unrest === undefined ? {} : { unrest }),
    treasury: SafeInt(100_000),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(rateBp),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `fleet-${id}`,
        nationId: id,
        name: id,
        locationAreaId: "a-1",
        ships: [ship("d-1")],
      },
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

function wars(startDate: string | undefined): WarState {
  return {
    wars:
      startDate === undefined
        ? []
        : [
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
              startDate,
              status: "ACTIVE",
            },
          ],
    battles: [],
    participantMemberships:
      startDate === undefined
        ? []
        : [
            {
              warId: "w1",
              nationId: "FRA",
              sideId: "a",
              status: "ACTIVE",
              entryMonth: startDate,
              nationalContributionPoints: 0,
            },
            {
              warId: "w1",
              nationId: "GBR",
              sideId: "d",
              status: "ACTIVE",
              entryMonth: startDate,
              nationalContributionPoints: 0,
            },
          ],
    blockadeState: [],
    battleManifests: [],
  };
}

interface Scenario {
  readonly rateBp?: number;
  readonly unrest?: number;
  readonly aiUnrest?: number;
  readonly aiGovernment?: GovernmentType;
  readonly playerGovernment?: GovernmentType;
  readonly warStart?: string;
  readonly prestige?: number;
  readonly sackingBp?: number;
}

function snapshot(s: Scenario): CampaignSnapshot {
  return {
    prestigeRules: {
      ...FIXTURE_PRESTIGE_RULES,
      ...(s.sackingBp === undefined ? {} : { sackingProbabilityBp: SafeInt(s.sackingBp) }),
    },
    version: "0.1.0",
    turnNumber: SafeInt(5),
    campaignId: "unrest",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
    ],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        {
          ...nation("GBR", s.rateBp ?? 2_000, s.unrest),
          ...(s.playerGovernment === undefined ? {} : { governmentType: s.playerGovernment }),
          ...(s.prestige === undefined ? {} : { prestige: SafeInt(s.prestige) }),
        },
      ],
      [
        "FRA",
        {
          ...nation("FRA", 2_000, s.aiUnrest),
          ...(s.aiGovernment === undefined ? {} : { governmentType: s.aiGovernment }),
        },
      ],
    ]),
    wars: wars(s.warStart),
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

function run(s: Scenario, rules: UnrestRules | null = RULES) {
  return new MonthExecutor().execute(
    snapshot(s),
    [],
    "unrest-seed",
    new DiagnosticCollector(),
    undefined,
    rules === null ? { playerNationId: "GBR" } : { playerNationId: "GBR", unrest: rules },
  );
}

describe("#996: the unrest phase", () => {
  it("runs after base limits and before sacking", () => {
    const ids = monthPipeline.phaseIds;
    expect(ids.indexOf("unrest")).toBe(ids.indexOf("base_limits") + 1);
    expect(ids.indexOf("unrest")).toBe(ids.indexOf("sacking") - 1);
  });

  it("raises unrest for an appropriation above the reference and records why", () => {
    const result = run({ rateBp: 3_000 });
    const gbr = result.finalSnapshot.nations.get("GBR");
    expect(gbr?.unrest).toBe(2);
    expect(gbr?.unrestLastChange).toEqual({
      month: "1880-06",
      before: 0,
      after: 2,
      contributions: [{ reasonCode: "MILITARY_SPENDING", delta: 2 }],
    });
    const events = result.eventLedger.all.filter((e) => e.body.kind === "UnrestChanged");
    expect(events.map((e) => e.body)).toEqual([
      expect.objectContaining({
        nationId: "GBR",
        reasonCode: "MILITARY_SPENDING",
        before: 0,
        after: 2,
        delta: 2,
      }),
    ]);
  });

  it("lowers unrest for an appropriation below the reference", () => {
    const gbr = run({ rateBp: 1_500, unrest: 3 }).finalSnapshot.nations.get("GBR");
    expect(gbr?.unrest).toBe(2);
    expect(gbr?.unrestLastChange?.contributions).toEqual([
      { reasonCode: "SPENDING_CUT", delta: -1 },
    ]);
  });

  it("relieves unrest in the month a war breaks out", () => {
    const gbr = run({ unrest: 3, warStart: "1880-06" }).finalSnapshot.nations.get("GBR");
    expect(gbr?.unrest).toBe(2);
    expect(gbr?.unrestLastChange?.contributions).toEqual([
      { reasonCode: "WAR_OUTBREAK", delta: -1 },
    ]);
  });

  it("raises unrest every month once a war has lasted the configured months", () => {
    const gbr = run({ unrest: 3, warStart: "1879-06" }).finalSnapshot.nations.get("GBR");
    expect(gbr?.unrest).toBe(4);
    expect(gbr?.unrestLastChange?.contributions).toEqual([
      { reasonCode: "WAR_DURATION", delta: 1 },
    ]);
  });

  it("leaves unrest absent when no driver applies", () => {
    const gbr = run({}).finalSnapshot.nations.get("GBR");
    expect(gbr?.unrest).toBeUndefined();
    expect(gbr?.unrestLastChange).toBeUndefined();
  });

  it("drives AI nations by the same rules", () => {
    const fra = run({ aiUnrest: 4 }).finalSnapshot.nations.get("FRA");
    expect(fra?.unrest).toBe(4);
  });

  it("is dormant without the ruleset section", () => {
    const result = run({ rateBp: 3_000 }, null);
    const gbr = result.finalSnapshot.nations.get("GBR");
    expect(gbr?.unrest).toBeUndefined();
    expect(result.eventLedger.all.some((e) => e.body.kind.startsWith("Unrest"))).toBe(false);
  });
});

describe("#996: strikes", () => {
  it("lowers the appropriation rate at the strike threshold and logs it", () => {
    const result = run({ unrest: 7 });
    const gbr = result.finalSnapshot.nations.get("GBR");
    expect(gbr?.navalAppropriationRateBp).toBe(1_750);
    const strike = result.eventLedger.all.find((e) => e.body.kind === "UnrestConsequence");
    expect(strike?.body).toMatchObject({
      nationId: "GBR",
      consequence: "STRIKE",
      rateBeforeBp: 2_000,
      rateAfterBp: 1_750,
      careerEnded: false,
    });
  });

  it("does not strike below the threshold", () => {
    const gbr = run({ unrest: 6 }).finalSnapshot.nations.get("GBR");
    expect(gbr?.navalAppropriationRateBp).toBe(2_000);
  });
});

describe("#996: revolution", () => {
  it("ends the player's career with REVOLUTION when a war coincides with the threshold", () => {
    const result = run({ unrest: 9, warStart: "1880-01" });
    expect(result.finalSnapshot.careerResult).toMatchObject({ reason: "REVOLUTION" });
    const draws = result.randomLedger.all.filter((d) => d.streamId === "unrest_revolution");
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({ entityKey: "GBR/1880-06", outcome: "REVOLUTION" });
  });

  it("is not overwritten by a sacking in the same month", () => {
    const result = run({ unrest: 9, warStart: "1880-01", prestige: 5, sackingBp: 10_000 });
    expect(result.finalSnapshot.careerResult).toMatchObject({ reason: "REVOLUTION" });
  });

  it("needs a war", () => {
    const result = run({ unrest: 9 });
    expect(result.finalSnapshot.careerResult).toBeUndefined();
    expect(result.randomLedger.all.some((d) => d.streamId === "unrest_revolution")).toBe(false);
  });

  it("keeps the career when the draw falls above the probability", () => {
    const result = run(
      { unrest: 9, warStart: "1880-01" },
      { ...RULES, revolutionProbabilityBp: 1 },
    );
    expect(result.finalSnapshot.careerResult).toBeUndefined();
    const draws = result.randomLedger.all.filter((d) => d.streamId === "unrest_revolution");
    expect(draws[0]?.outcome).toBe("QUIET");
  });

  it("ends an AI nation's wars and settles its unrest at the aftermath level", () => {
    const result = run({ aiUnrest: 9, warStart: "1880-01" });
    const fra = result.finalSnapshot.nations.get("FRA");
    expect(fra?.unrest).toBe(5);
    expect(fra?.unrestLastChange?.contributions.map((c) => c.reasonCode)).toContain(
      "REVOLUTION_AFTERMATH",
    );
    expect(result.finalSnapshot.wars.wars.every((w) => w.status === "ENDED")).toBe(true);
    expect(result.finalSnapshot.careerResult).toBeUndefined();
  });

  it("replaces an AI nation's government by the ruleset table and logs both ends", () => {
    const result = run({ aiUnrest: 9, warStart: "1880-01", aiGovernment: "autocratic" });
    expect(result.finalSnapshot.nations.get("FRA")?.governmentType).toBe("communist");
    expect(result.eventLedger.all.map((e) => e.body)).toContainEqual(
      expect.objectContaining({
        kind: "UnrestConsequence",
        nationId: "FRA",
        consequence: "REVOLUTION",
        governmentBefore: "autocratic",
        governmentAfter: "communist",
      }),
    );
  });

  it("leaves an AI nation without a government type untouched", () => {
    const result = run({ aiUnrest: 9, warStart: "1880-01" });
    expect(result.finalSnapshot.nations.get("FRA")?.governmentType).toBeUndefined();
  });

  it("keeps the government when the ruleset has no table", () => {
    const { governmentAfterRevolution: _table, ...bare } = RULES;
    const result = run({ aiUnrest: 9, warStart: "1880-01", aiGovernment: "autocratic" }, bare);
    expect(result.finalSnapshot.nations.get("FRA")?.governmentType).toBe("autocratic");
  });

  it("keeps the player's government when the career ends", () => {
    const result = run({ unrest: 9, warStart: "1880-01", playerGovernment: "autocratic" });
    expect(result.finalSnapshot.nations.get("GBR")?.governmentType).toBe("autocratic");
  });
});
