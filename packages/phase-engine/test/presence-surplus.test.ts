import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const RULES = {
  colonialServiceDisplacementBp: 137,
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
  penaltyRequests: true as const,
  shortfallPrestige: {
    lossBpPerWholeShortfall: 200,
    maxLossBp: 500,
    openingGraceMonths: 2,
    surplusShipsOnly: true as const,
  },
};

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "cruiser",
    nationId: "GBR",
    locationAreaId: "india",
    designVersionId: "d-plain",
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
    ...over,
  };
}

function nation(ships: Ship[]): NationState {
  return {
    prestige: SafeInt(100),
    id: "GBR",
    name: "GBR",
    tag: "GBR",
    treasury: SafeInt(10000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: "fleet-GBR", nationId: "GBR", name: "GBR", locationAreaId: "india", ships }],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function design(id: string, kg: number): CompiledDesignVersion {
  return { designVersionId: id, normalizedDisplacementKg: SafeInt(kg) } as CompiledDesignVersion;
}

interface Scenario {
  readonly ships: Ship[];
  readonly turn?: number;
  readonly slot?: "playable" | "ai";
  readonly capePossessions?: number;
}

function snapshot(s: Scenario): CampaignSnapshot {
  const cape = Array.from({ length: s.capePossessions ?? 1 }, (_, i) => ({
    id: `p-cape-${i}`,
    nationId: "GBR",
    areaId: "cape",
  }));
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(s.turn ?? 2),
    campaignId: "presence-surplus",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: s.slot ?? "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      possessions: [{ id: "p-india", nationId: "GBR", areaId: "india" }, ...cape],
    },
    nations: new Map([["GBR", nation(s.ships)]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([
      ["d-plain", design("d-plain", 1_000_000)],
      ["d-small", design("d-small", 300_000)],
    ]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

function charged(s: Scenario): boolean {
  const result = new MonthExecutor().execute(
    snapshot(s),
    [],
    "presence-surplus-seed",
    new DiagnosticCollector(),
    undefined,
    { shipBuilding: productionShipBuildingContent(), presence: RULES },
  );
  return result.eventLedger.all.some(
    (e) => e.body.kind === "PrestigeChanged" && e.body.reasonCode === "PRESENCE_SHORTFALL",
  );
}

describe("#838: presence shortfall bites on neglect, not on the opening", () => {
  const idlePair = [ship("a"), ship("b")];

  it("charges a nation that leaves a surplus ship idle while an area stays uncovered", () => {
    expect(charged({ ships: idlePair })).toBe(true);
  });

  it("charges nothing during the opening grace, then charges from the first month after it", () => {
    expect(charged({ ships: idlePair, turn: 0 })).toBe(false);
    expect(charged({ ships: idlePair, turn: 1 })).toBe(false);
    expect(charged({ ships: idlePair, turn: 2 })).toBe(true);
  });

  it("does not charge a nation with no ship it could move, however short it is", () => {
    expect(charged({ ships: [] })).toBe(false);
    expect(charged({ ships: [ship("a")] })).toBe(false);
  });

  it("does not charge once the surplus ship is posted to a foreign station", () => {
    const posted = [ship("a"), ship("b", { stationAssignment: "FOREIGN_STATION" })];
    expect(charged({ ships: posted })).toBe(false);
  });

  it("does not charge once the surplus ship has covered the short area", () => {
    expect(charged({ ships: [ship("a"), ship("b", { locationAreaId: "cape" })] })).toBe(false);
  });

  it("does not charge for an area no surplus ship is big enough to cover", () => {
    const small = [
      ship("a", { designVersionId: "d-small" }),
      ship("b", { designVersionId: "d-small" }),
    ];
    expect(charged({ ships: small, capePossessions: 3 })).toBe(false);
    expect(charged({ ships: small, capePossessions: 1 })).toBe(true);
  });

  it("does not charge a nation held by an AI slot, which has no way to post a ship", () => {
    expect(charged({ ships: idlePair, slot: "ai" })).toBe(false);
  });

  it("does not charge for a ship that was not yet ACTIVE at the start of the month", () => {
    const coming = [ship("a"), ship("b", { readiness: "WORKING_UP" })];
    expect(charged({ ships: coming })).toBe(false);
  });
});
