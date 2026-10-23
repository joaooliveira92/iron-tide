import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { CommandLedger, CommandLifecycle } from "@bluewave/commands";
import { SafeInt, TURN_PHASES, type TurnPhase } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { RandomLedger } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";
import {
  MonthExecutor,
  MonthPipeline,
  monthPipeline,
  PHASE_ACCESS_DENIED,
  type MonthPhase,
  type MonthRunState,
  type PhasePermissions,
} from "../src/index.js";
import { FinancialLedger } from "../src/financial-ledger.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function createEmptySnapshot(turn?: SafeInt): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: turn ?? SafeInt(0),
    campaignId: "test-campaign",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map(),
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

function createNationState(id: string, treasury: SafeInt): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury,
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
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
    isPlayable: true,
    isAI: false,
  };
}

function createState(
  snapshot: CampaignSnapshot,
  collector = new DiagnosticCollector(),
): MonthRunState {
  return {
    currentSnapshot: snapshot,
    sourceSnapshot: snapshot,
    slots: snapshot["slots"],
    commands: [],
    campaignMonth: "1880-01",
    turnNumber: snapshot["turnNumber"],
    randomSeed: "test-seed",
    commandLedger: new CommandLedger(),
    eventLedger: new EventLedger(),
    randomLedger: new RandomLedger(),
    financialLedger: new FinancialLedger(),
    lifecycle: new CommandLifecycle(),
    collector,
    nextSeq: () => SafeInt(0),
  };
}

const PERMISSIVE: PhasePermissions = { reads: "all", writes: "all", rng: true };

function noopPhases(overrides: Partial<Record<TurnPhase, PhasePermissions>> = {}): MonthPhase[] {
  return TURN_PHASES.map((id) => ({
    id,
    name: id,
    permissions: overrides[id] ?? PERMISSIVE,
    run: () => ({ status: "continue" }),
  }));
}

function replacePhase(phases: readonly MonthPhase[], phase: MonthPhase): MonthPhase[] {
  return phases.map((candidate) => (candidate.id === phase.id ? phase : candidate));
}

describe("MonthPipeline", () => {
  it("pins the canonical turn order, including the interruption checkpoint", () => {
    expect(monthPipeline.phaseIds).toEqual([
      "opening_validation",
      "weather_generation",
      "monthly_revenue",
      "command_collection",
      "ai_planning",
      "ai_procurement",
      "appropriation",
      "maintenance",
      "obligation",
      "construction_processing",
      "resolve_diplomacy",
      "resolve_research",
      "resolve_aircraft_development",
      "resolve_carrier_operations",
      "battle_generation",
      "battle_resolution",
      "presence_measurement",
      "foreign_station_deployment",
      "base_limits",
      "sacking",
      "closing_validation",
    ]);
    expect(monthPipeline.nodes.map((node) => `${node.kind}:${node.id}`)).toEqual([
      "phase:opening_validation",
      "phase:weather_generation",
      "phase:monthly_revenue",
      "phase:command_collection",
      "phase:ai_planning",
      "phase:ai_procurement",
      "phase:appropriation",
      "phase:maintenance",
      "phase:obligation",
      "phase:construction_processing",
      "phase:resolve_diplomacy",
      "phase:resolve_research",
      "phase:resolve_aircraft_development",
      "phase:resolve_carrier_operations",
      "checkpoint:interruption_checkpoint",
      "phase:battle_generation",
      "phase:battle_resolution",
      "phase:presence_measurement",
      "phase:foreign_station_deployment",
      "phase:base_limits",
      "phase:sacking",
      "phase:closing_validation",
    ]);
  });

  it("rejects incomplete, duplicated, or unknown phase definitions", () => {
    expect(() => MonthPipeline.create(noopPhases().slice(1))).toThrow(/has no implementation/);

    const duplicated = noopPhases();
    duplicated.push(duplicated[0]!);
    expect(() => MonthPipeline.create(duplicated)).toThrow(/registered more than once/);

    const unknown = noopPhases();
    unknown[0] = { ...unknown[0]!, id: "unknown_phase" as TurnPhase };
    expect(() => MonthPipeline.create(unknown)).toThrow(/not part of the turn contract/);
  });

  it("observes reads and fails closed when a phase reads outside its grant", () => {
    const collector = new DiagnosticCollector();
    const phases = replacePhase(noopPhases(), {
      id: "opening_validation",
      name: "opening_validation",
      permissions: { reads: ["nations"], writes: [], rng: false },
      run: (ctx) => {
        ctx.snapshot.read("wars");
        return { status: "continue" };
      },
    });
    const state = createState(createEmptySnapshot(), collector);

    expect(MonthPipeline.create(phases).run(state)).toBe(false);
    expect(collector.errors.some((error) => error.code === PHASE_ACCESS_DENIED)).toBe(true);
    expect(collector.errors[0]?.message).toContain('reads resource "wars" without read permission');
  });

  it("discards writes from a phase that oversteps its grant", () => {
    const collector = new DiagnosticCollector();
    const phases = replacePhase(noopPhases(), {
      id: "opening_validation",
      name: "opening_validation",
      permissions: { reads: ["nations", "wars"], writes: [], rng: false },
      run: (ctx) => {
        const nations = new Map(ctx.snapshot.read("nations"));
        nations.set("GBR", createNationState("GBR", SafeInt(1)));
        ctx.snapshot.write("nations", nations);
        return { status: "continue" };
      },
    });
    const snapshot = createEmptySnapshot();
    const state = createState(snapshot, collector);

    expect(MonthPipeline.create(phases).run(state)).toBe(false);
    expect(state.currentSnapshot).toBe(snapshot);
    expect(collector.errors[0]?.message).toContain(
      'writes resource "nations" without write permission',
    );
  });

  it("fails closed when a phase draws randomness without a grant", () => {
    const collector = new DiagnosticCollector();
    const phases = replacePhase(noopPhases(), {
      id: "opening_validation",
      name: "opening_validation",
      permissions: { reads: [], writes: [], rng: false },
      run: (ctx) => {
        ctx.rng.seed();
        return { status: "continue" };
      },
    });
    const state = createState(createEmptySnapshot(), collector);

    expect(MonthPipeline.create(phases).run(state)).toBe(false);
    expect(collector.errors[0]?.message).toContain("draws randomness without rng permission");
  });

  it("allows access that stays inside the declared permissions", () => {
    const phases = replacePhase(noopPhases(), {
      id: "opening_validation",
      name: "opening_validation",
      permissions: { reads: ["wars"], writes: ["wars"], rng: false },
      run: (ctx) => {
        const wars = ctx.snapshot.read("wars");
        ctx.snapshot.write("wars", { ...wars });
        return { status: "continue" };
      },
    });
    const state = createState(createEmptySnapshot());

    expect(MonthPipeline.create(phases).run(state)).toBe(true);
  });

  it("applies permission overrides to a single phase", () => {
    const collector = new DiagnosticCollector();
    const phases = replacePhase(noopPhases(), {
      id: "opening_validation",
      name: "opening_validation",
      permissions: PERMISSIVE,
      run: (ctx) => {
        ctx.snapshot.read("wars");
        return { status: "continue" };
      },
    });
    const overrides = new Map<TurnPhase, PhasePermissions>([
      ["opening_validation", { reads: [], writes: [], rng: false }],
    ]);
    const state = createState(createEmptySnapshot(), collector);

    expect(MonthPipeline.create(phases).run(state, overrides)).toBe(false);
    expect(collector.errors[0]?.message).toContain('phase "opening_validation"');
  });

  it("stops the month when a checkpoint returns false", () => {
    const collector = new DiagnosticCollector();
    const phases = noopPhases();
    const checkpoint = {
      id: "stop_after_opening",
      name: "Stop After Opening",
      after: "opening_validation" as const,
      permissions: { reads: [], writes: [], rng: false } as const,
      run: () => false,
    };
    const pipeline = MonthPipeline.create(
      replacePhase(phases, {
        id: "opening_validation",
        name: "opening_validation",
        permissions: PERMISSIVE,
        run: () => ({ status: "continue" }),
      }),
      [checkpoint],
    );
    const state = createState(createEmptySnapshot(), collector);

    expect(pipeline.run(state)).toBe(true);
    expect(collector.errors).toEqual([]);
  });
});

describe("Opening/closing validation via MonthExecutor", () => {
  it("opening validation rejects construction progress overflow via MonthExecutor", () => {
    const nations = new Map<string, NationState>();
    const nation = createNationState("GBR", SafeInt(100));
    nation["fleets"] = [
      {
        id: "fleet-1",
        nationId: "GBR",
        name: "Test Fleet",
        locationAreaId: "area-1",
        ships: [
          {
            id: "ship-1",
            name: "Test Ship",
            classId: "class-1",
            nationId: "GBR",
            locationAreaId: "area-1",
            designVersionId: "",
            hitPoints: SafeInt(100),
            maxHitPoints: SafeInt(100),
            speed: SafeInt(10),
            firepower: SafeInt(10),
            armor: SafeInt(10),
            isUnderConstruction: true,
            constructionProgress: SafeInt(80),
            constructionTotalWork: SafeInt(50),
            readiness: "WORKING_UP",
            crewQuality: SafeInt(0),
          },
        ],
      },
    ];
    nations.set("GBR", nation);
    const snapshot = createEmptySnapshot();
    snapshot["nations"] = nations;
    const collector = new DiagnosticCollector();

    const result = new MonthExecutor().execute(snapshot, [], "test-seed", collector);

    expect(result["success"]).toBe(false);
    const hasConstDiag = collector.errors.some((d) => d["code"] === "CONSTRUCTION_OVERFLOW");
    expect(hasConstDiag).toBe(true);
  });

  it("opening validation rejects ship in multiple battles via MonthExecutor", () => {
    const nations = new Map<string, NationState>();
    const nation = createNationState("GBR", SafeInt(100));
    nation["fleets"] = [
      {
        id: "fleet-1",
        nationId: "GBR",
        name: "Test Fleet",
        locationAreaId: "area-1",
        ships: [
          {
            id: "ship-1",
            name: "Ship 1",
            classId: "class-1",
            nationId: "GBR",
            locationAreaId: "area-1",
            designVersionId: "",
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
            inBattleId: "battle-1",
          },
        ],
      },
    ];
    nations.set("GBR", nation);
    const snapshot = createEmptySnapshot();
    snapshot["nations"] = nations;
    snapshot["wars"] = {
      wars: [],
      battles: [
        {
          id: "battle-1",
          phase: "pending",
          attackerId: "GBR",
          defenderId: "FRA",
          areaId: "area-3",
          attackerFleetIds: ["fleet-1"],
          defenderFleetIds: [],
        },
        {
          id: "battle-2",
          phase: "pending",
          attackerId: "FRA",
          defenderId: "GBR",
          areaId: "area-3",
          attackerFleetIds: ["fleet-1"],
          defenderFleetIds: [],
        },
      ],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    };
    const collector = new DiagnosticCollector();

    const result = new MonthExecutor().execute(snapshot, [], "test-seed", collector);

    expect(result["success"]).toBe(false);
    const hasShipDiag = collector.errors.some((d) => d["code"] === "SHIP_IN_MULTIPLE_BATTLES");
    expect(hasShipDiag).toBe(true);
  });

  it("closing invariants run and succeed via MonthExecutor", () => {
    const snapshot = createEmptySnapshot(SafeInt(1));
    const collector = new DiagnosticCollector();

    const result = new MonthExecutor().execute(snapshot, [], "test-seed", collector);

    expect(result["success"]).toBe(true);
    const _expectedHash = sha256Hex(canonicalSerialize(snapshot));
    expect(result["success"]).toBe(true);
  });
});
