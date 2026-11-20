import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  NationState,
  Ship,
  WarState,
} from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { MonthExecutor } from "../../src/index.js";

export const TRADE_RULES: TradeProtectionRules = {
  sectionVersion: 1,
  fleetShareBp: 2500,
  resourcesPerRequiredShip: 100,
  contributingHullTypes: ["destroyer", "protected_cruiser"],
  raiderHullTypes: ["protected_cruiser", "armed_merchant_cruiser"],
  amcHullType: "armed_merchant_cruiser",
  amcMinSpeedUms: 4_115_552,
  raiderHitBp: 10_000,
  shortfallAmplifyBp: 5000,
  lossPerHitBp: 1000,
  pressureChanceBp: 10_000,
  pressureLossBp: 500,
  recoveryBpPerMonth: 200,
  revenueSensitivityBp: 5000,
  unrestThresholdBp: 1000,
  unrestCadenceMonths: 1,
  unrestStep: 1,
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [
      {
        title: "Rule the Waves 3 manual",
        author: "Naval War Simulations / Matrix Games",
        year: 2023,
        page: "70",
        section: "Trade protection",
      },
    ],
    note: "PROVISIONAL test fixture",
  },
};

export function tradeShip(
  id: string,
  designVersionId: string,
  over: Partial<Ship> = {},
  nationId = "GBR",
): Ship {
  return {
    id,
    name: id,
    classId: "cruiser",
    nationId,
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
    ...over,
  };
}

export function tradeDesign(
  designVersionId: string,
  hullType: string,
  over: Partial<CompiledDesignVersion> = {},
): CompiledDesignVersion {
  return {
    designVersionId,
    hullType,
    normalizedDisplacementKg: SafeInt(1_000_000),
    normalizedSpeedUms: SafeInt(10_000_000),
    ...over,
  } as CompiledDesignVersion;
}

function nation(
  id: string,
  ships: Ship[],
  over: Partial<NationState> = {},
  treasury = 100_000,
): NationState {
  return {
    prestige: SafeInt(50),
    id,
    name: id,
    tag: id,
    treasury: SafeInt(treasury),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: `fleet-${id}`, nationId: id, name: id, locationAreaId: "a-1", ships }],
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
    ...over,
  };
}

export interface TradeScenario {
  readonly gbrShips: Ship[];
  readonly frashipsRaiders?: Ship[];
  readonly designs?: CompiledDesignVersion[];
  readonly atWar?: boolean;
  readonly blockade?: "FRA_BLOCKADES_GBR" | "GBR_BLOCKADES_FRA";
  readonly gbr?: Partial<NationState>;
  readonly fra?: Partial<NationState>;
  readonly month?: number;
}

function wars(s: TradeScenario): WarState {
  const blockade =
    s.blockade === "FRA_BLOCKADES_GBR"
      ? [
          {
            blockaderId: "FRA",
            blockadedNationId: "GBR",
            areaId: "a-1",
            establishedMonth: "1880-01",
          },
        ]
      : s.blockade === "GBR_BLOCKADES_FRA"
        ? [
            {
              blockaderId: "GBR",
              blockadedNationId: "FRA",
              areaId: "a-1",
              establishedMonth: "1880-01",
            },
          ]
        : [];
  return {
    wars:
      s.atWar === false
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
              startDate: "1880-01",
              status: "ACTIVE",
            },
          ],
    battles: [],
    participantMemberships: [],
    blockadeState: blockade,
    battleManifests: [],
  };
}

export function tradeSnapshot(s: TradeScenario): CampaignSnapshot {
  const designs = s.designs ?? [
    tradeDesign("d-dd", "destroyer"),
    tradeDesign("d-cp", "protected_cruiser"),
  ];
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(s.month ?? 5),
    campaignId: "trade-protection",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
    ],
    world: { areas: [], routes: [], ports: [], possessions: [] },
    nations: new Map([
      ["GBR", nation("GBR", s.gbrShips, s.gbr)],
      ["FRA", nation("FRA", s.frashipsRaiders ?? [], s.fra)],
    ]),
    wars: wars(s),
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(designs.map((d) => [d.designVersionId, d])),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

export const tradeEnvelope = (
  body: CommandBody,
  from: CampaignSnapshot,
): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}-${JSON.stringify(body)}`,
  timestamp: "test",
  body,
});

export function runTrade(
  from: CampaignSnapshot,
  commands: CommandEnvelope<CommandBody>[] = [],
  rules: TradeProtectionRules | null = TRADE_RULES,
  seed = "trade-seed",
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    from,
    commands,
    seed,
    collector,
    undefined,
    rules === null ? { playerNationId: "GBR" } : { playerNationId: "GBR", tradeProtection: rules },
  );
  return Object.assign(result, { collector });
}

export const gbrShips = (s: CampaignSnapshot) => s.nations.get("GBR")!.fleets[0]!.ships;
