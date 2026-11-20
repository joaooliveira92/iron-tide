import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { UnrestRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

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

function nation(id: string, unrest: number | undefined, isPlayer: boolean): NationState {
  return {
    prestige: SafeInt(50),
    id,
    name: id,
    tag: id,
    homeAreaId: `${id.toLowerCase()}_home`,
    ...(unrest === undefined ? {} : { unrest }),
    treasury: SafeInt(100_000),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
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
    isPlayable: isPlayer,
    isAI: !isPlayer,
  };
}

interface Scenario {
  readonly counterpartScore: number;
  readonly counterpartIsPlayer: boolean;
  readonly revoltingIsAttacker?: boolean;
}

function snapshot(s: Scenario): CampaignSnapshot {
  const attacker = s.revoltingIsAttacker === false ? "GBR" : "FRA";
  const defender = attacker === "FRA" ? "GBR" : "FRA";
  const scoreOf = (id: string) => (id === "GBR" ? s.counterpartScore : 0);
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(5),
    campaignId: "unrest-peace",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: s.counterpartIsPlayer ? "playable" : "ai" },
      { nationId: "FRA", type: "ai" },
      { nationId: "GER", type: s.counterpartIsPlayer ? "ai" : "playable" },
    ],
    world: {
      areas: [
        { id: "gbr_home", name: "Britain", type: "coastal", controller: "GBR" },
        { id: "fra_home", name: "France", type: "coastal", controller: "FRA" },
        { id: "ger_home", name: "Germany", type: "coastal", controller: "GER" },
        {
          id: "fra_colony",
          name: "Colony",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(20),
        },
        {
          id: "fra_far",
          name: "Far colony",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(50),
        },
      ],
      routes: [],
      ports: [],
      possessions: [
        { id: "p-colony", nationId: "FRA", areaId: "fra_colony" },
        { id: "p-far", nationId: "FRA", areaId: "fra_far" },
      ],
    },
    nations: new Map([
      ["GBR", nation("GBR", undefined, s.counterpartIsPlayer)],
      ["FRA", nation("FRA", 9, false)],
      ["GER", nation("GER", undefined, !s.counterpartIsPlayer)],
    ]),
    wars: {
      wars: [
        {
          id: "w1",
          attackerSideId: "a",
          defenderSideId: "d",
          attackerSideMembers: [attacker],
          defenderSideMembers: [defender],
          attackerWarScore: scoreOf(attacker),
          defenderWarScore: scoreOf(defender),
          attackerId: attacker,
          defenderId: defender,
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
      participantMemberships: [
        {
          warId: "w1",
          nationId: attacker,
          sideId: "a",
          status: "ACTIVE",
          entryMonth: "1880-01",
          nationalContributionPoints: 0,
        },
        {
          warId: "w1",
          nationId: defender,
          sideId: "d",
          status: "ACTIVE",
          entryMonth: "1880-01",
          nationalContributionPoints: 0,
        },
      ],
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

function run(s: Scenario) {
  return new MonthExecutor().execute(
    snapshot(s),
    [],
    "unrest-peace-seed",
    new DiagnosticCollector(),
    undefined,
    {
      playerNationId: s.counterpartIsPlayer ? "GBR" : "GER",
      unrest: RULES,
    },
  );
}

function transfers(result: ReturnType<typeof run>) {
  return result.eventLedger.all
    .filter((e) => e.eventType === "PossessionTransferred")
    .map((e) => e.body);
}

describe("#1017: AI revolution peace terms", () => {
  it("cedes the dearest area the counterpart's war score can afford to the counterpart", () => {
    const result = run({ counterpartScore: 30, counterpartIsPlayer: true });
    const world = result.finalSnapshot.world;
    expect(world.areas.find((a) => a.id === "fra_colony")?.controller).toBe("GBR");
    expect(world.areas.find((a) => a.id === "fra_far")?.controller).toBe("FRA");
    expect(world.possessions?.find((p) => p.id === "p-colony")?.nationId).toBe("GBR");
    expect(transfers(result)).toEqual([
      {
        kind: "PossessionTransferred",
        possessionId: "p-colony",
        areaId: "fra_colony",
        fromNationId: "FRA",
        toNationId: "GBR",
        warId: "w1",
      },
    ]);
    expect(result.finalSnapshot.wars.wars.every((w) => w.status === "ENDED")).toBe(true);
  });

  it("applies the same terms between two AI nations", () => {
    const result = run({ counterpartScore: 60, counterpartIsPlayer: false });
    expect(result.finalSnapshot.world.areas.find((a) => a.id === "fra_far")?.controller).toBe(
      "GBR",
    );
  });

  it("applies the terms when the revolting nation was the defender", () => {
    const result = run({
      counterpartScore: 30,
      counterpartIsPlayer: true,
      revoltingIsAttacker: false,
    });
    expect(result.finalSnapshot.world.areas.find((a) => a.id === "fra_colony")?.controller).toBe(
      "GBR",
    );
  });

  it("ends the war at status quo when the counterpart has no war score to spend", () => {
    const result = run({ counterpartScore: 0, counterpartIsPlayer: true });
    expect(transfers(result)).toEqual([]);
    expect(result.finalSnapshot.wars.wars.every((w) => w.status === "ENDED")).toBe(true);
    expect(result.finalSnapshot.world.areas.find((a) => a.id === "fra_colony")?.controller).toBe(
      "FRA",
    );
  });

  it("never cedes the revolting nation's home area", () => {
    const result = run({ counterpartScore: 1_000, counterpartIsPlayer: true });
    expect(result.finalSnapshot.world.areas.find((a) => a.id === "fra_home")?.controller).toBe(
      "FRA",
    );
  });

  it("is reproducible across runs", () => {
    const first = run({ counterpartScore: 30, counterpartIsPlayer: true });
    const second = run({ counterpartScore: 30, counterpartIsPlayer: true });
    expect(second.finalSnapshot.world).toEqual(first.finalSnapshot.world);
    expect(second.eventLedger.all.map((e) => e.eventId)).toEqual(
      first.eventLedger.all.map((e) => e.eventId),
    );
  });
});
