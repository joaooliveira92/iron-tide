import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  NationState,
  Ship,
  WarState,
} from "@bluewave/campaign";
import type { FleetMoraleRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

const RULES: FleetMoraleRules = {
  sectionVersion: 1,
  unpaidFundsLoss: 10,
  blockadeCrampedLoss: 5,
  longWarMonths: 3,
  recoveryPerMonth: 4,
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [
      {
        title: "Rule the Waves 3 manual",
        author: "Naval War Simulations / Matrix Games",
        year: 2023,
        page: "13",
        section: "Running out of funds lowers prestige and affects fleet morale",
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

function nation(id: string, treasury: number, fleetMorale: number | undefined): NationState {
  return {
    prestige: SafeInt(50),
    id,
    name: id,
    tag: id,
    ...(fleetMorale === undefined ? {} : { fleetMorale }),
    treasury: SafeInt(treasury),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `fleet-${id}`,
        nationId: id,
        name: id,
        locationAreaId: "a-1",
        ships: [ship("d-cramped")],
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

function wars(blockaded: boolean): WarState {
  return {
    wars: blockaded
      ? [
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
            startDate: "1880-01",
            status: "ACTIVE",
          },
        ]
      : [],
    battles: [],
    participantMemberships: [],
    blockadeState: blockaded
      ? [
          {
            blockaderId: "FRA",
            blockadedNationId: "GBR",
            areaId: "a-1",
            establishedMonth: "1880-01",
          },
        ]
      : [],
    battleManifests: [],
  };
}

interface Scenario {
  readonly treasury: number;
  readonly fleetMorale?: number;
  readonly blockaded?: boolean;
  readonly cramped?: boolean;
  readonly turn?: number;
}

function snapshot(s: Scenario): CampaignSnapshot {
  const design = {
    designVersionId: "d-cramped",
    normalizedDisplacementKg: SafeInt(1_000_000),
    ...(s.cramped === false ? {} : { crampedAccommodation: true as const }),
  } as CompiledDesignVersion;
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(s.turn ?? 5),
    campaignId: "fleet-morale",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
    ],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      ["GBR", nation("GBR", s.treasury, s.fleetMorale)],
      ["FRA", nation("FRA", 10, undefined)],
    ]),
    wars: wars(s.blockaded === true),
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([["d-cramped", design]]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

function run(s: Scenario, rules: FleetMoraleRules | null = RULES) {
  const result = new MonthExecutor().execute(
    snapshot(s),
    [],
    "fleet-morale-seed",
    new DiagnosticCollector(),
    undefined,
    rules === null ? { playerNationId: "GBR" } : { playerNationId: "GBR", fleetMorale: rules },
  );
  return result.finalSnapshot.nations;
}

describe("#884: fleet morale in the obligation phase", () => {
  it("lowers the player's morale by the rule in an unpaid month and records why", () => {
    const gbr = run({ treasury: 10 }).get("GBR");
    expect(gbr?.fleetMorale).toBe(90);
    expect(gbr?.fleetMoraleLastChange).toEqual({
      before: 100,
      after: 90,
      unclampedAfter: 90,
      contributions: [{ reasonCode: "UNPAID_FUNDS", delta: -10 }],
      month: expect.any(String),
    });
  });

  it("leaves morale absent in a paid month at full morale", () => {
    const gbr = run({ treasury: 1000 }).get("GBR");
    expect(gbr?.fleetMorale).toBeUndefined();
    expect(gbr?.fleetMoraleLastChange).toBeUndefined();
  });

  it("recovers by the rule in a paid month below full morale", () => {
    const gbr = run({ treasury: 1000, fleetMorale: 50 }).get("GBR");
    expect(gbr?.fleetMorale).toBe(54);
    expect(gbr?.fleetMoraleLastChange?.contributions).toEqual([
      { reasonCode: "RECOVERY", delta: 4 },
    ]);
  });

  it("lowers morale for a long blockade with cramped ships even when paid", () => {
    const gbr = run({ treasury: 1000, blockaded: true }).get("GBR");
    expect(gbr?.fleetMorale).toBe(95);
    expect(gbr?.fleetMoraleLastChange?.contributions).toEqual([
      { reasonCode: "BLOCKADE_CRAMPED", delta: -5 },
    ]);
  });

  it("does not lower morale for a blockade when no ship is cramped", () => {
    const gbr = run({ treasury: 1000, blockaded: true, cramped: false }).get("GBR");
    expect(gbr?.fleetMorale).toBeUndefined();
  });

  it("stacks unpaid and blockade drivers", () => {
    const gbr = run({ treasury: 10, blockaded: true }).get("GBR");
    expect(gbr?.fleetMorale).toBe(85);
  });

  it("never touches an AI nation, however short of funds", () => {
    expect(run({ treasury: 10 }).get("FRA")?.fleetMorale).toBeUndefined();
  });

  it("is dormant without the ruleset section", () => {
    const gbr = run({ treasury: 10 }, null).get("GBR");
    expect(gbr?.fleetMorale).toBeUndefined();
    expect(gbr?.fleetMoraleLastChange).toBeUndefined();
  });
});
