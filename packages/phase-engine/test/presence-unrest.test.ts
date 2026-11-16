import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  NationState,
  PresenceMeasurementRules,
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
  shortfallUnrest: { unrestPerShortMonth: 2 },
  shortfallPrestige: {
    lossBpPerWholeShortfall: 200,
    maxLossBp: 500,
    openingGraceMonths: 2,
    surplusShipsOnly: true as const,
  },
};

const RULES_WITHOUT_UNREST = {
  colonialServiceDisplacementBp: RULES.colonialServiceDisplacementBp,
  requiredTonsPerPossessionWeight: RULES.requiredTonsPerPossessionWeight,
  noPortValueWeight: RULES.noPortValueWeight,
  crampedOrShortRangeCountBp: RULES.crampedOrShortRangeCountBp,
  penaltyRequests: RULES.penaltyRequests,
  shortfallPrestige: RULES.shortfallPrestige,
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

function nation(ships: Ship[], unrest: number | undefined): NationState {
  return {
    prestige: SafeInt(100),
    id: "GBR",
    name: "GBR",
    tag: "GBR",
    ...(unrest === undefined ? {} : { unrest }),
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
  readonly unrest?: number;
  readonly blockaded?: boolean;
}

function wars(blockaded: boolean): CampaignSnapshot["wars"] {
  if (!blockaded) {
    return {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    };
  }
  return {
    wars: [
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
    ],
    battles: [],
    participantMemberships: [],
    blockadeState: [
      {
        blockaderId: "FRA",
        blockadedNationId: "GBR",
        areaId: "india",
        establishedMonth: "1880-01",
      },
    ],
    battleManifests: [],
  };
}

function snapshot(s: Scenario): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(s.turn ?? 2),
    campaignId: "presence-unrest",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: s.slot ?? "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      possessions: [
        { id: "p-india", nationId: "GBR", areaId: "india" },
        { id: "p-cape", nationId: "GBR", areaId: "cape" },
      ],
    },
    nations: new Map([["GBR", nation(s.ships, s.unrest)]]),
    wars: wars(s.blockaded === true),
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([["d-plain", design("d-plain", 1_000_000)]]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

function after(s: Scenario, presence: PresenceMeasurementRules = RULES): NationState | undefined {
  const result = new MonthExecutor().execute(
    snapshot(s),
    [],
    "presence-unrest-seed",
    new DiagnosticCollector(),
    undefined,
    { shipBuilding: productionShipBuildingContent(), presence },
  );
  return result.finalSnapshot.nations.get("GBR");
}

describe("#826: a presence shortfall nudges national unrest", () => {
  const idlePair = [ship("a"), ship("b")];

  it("raises unrest by the rule in a charged shortfall month, with the prestige loss", () => {
    const charged = after({ ships: idlePair });
    expect(charged?.unrest).toBe(2);
    expect(charged?.prestigeLastChange?.reasonCode).toBe("PRESENCE_SHORTFALL");
    expect(after({ ships: idlePair, unrest: 3 })?.unrest).toBe(5);
  });

  it("clamps unrest at the national maximum", () => {
    expect(after({ ships: idlePair, unrest: 9 })?.unrest).toBe(10);
  });

  it("leaves unrest untouched when the requirement is met", () => {
    const covered = [ship("a"), ship("b", { locationAreaId: "cape" })];
    expect(after({ ships: covered })?.unrest).toBeUndefined();
    expect(after({ ships: covered, unrest: 4 })?.unrest).toBe(4);
  });

  it("leaves unrest untouched during the opening grace", () => {
    expect(after({ ships: idlePair, turn: 1 })?.unrest).toBeUndefined();
  });

  it("leaves a blockaded nation at war untouched", () => {
    const blockaded = after({ ships: idlePair, blockaded: true });
    expect(blockaded?.unrest).toBeUndefined();
    expect(blockaded?.prestigeLastChange).toBeUndefined();
  });

  it("leaves unrest untouched for a nation held by an AI slot", () => {
    expect(after({ ships: idlePair, slot: "ai" })?.unrest).toBeUndefined();
  });

  it("leaves unrest untouched when the ruleset has no shortfallUnrest rule", () => {
    expect(after({ ships: idlePair }, RULES_WITHOUT_UNREST)?.unrest).toBeUndefined();
  });
});
