import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, PhaseGuard, PhaseRegistry } from "../src/index.js";
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

describe("PhaseRegistry", () => {
  it("returns phases in correct order", () => {
    const phases = PhaseRegistry.all;
    expect(phases.length).toBe(17);
    expect(phases[0]!["id"]).toBe("opening_validation");
    expect(phases[1]!["id"]).toBe("weather_generation");
    expect(phases[2]!["id"]).toBe("monthly_revenue");
    expect(phases[3]!["id"]).toBe("ai_planning");
    expect(phases[4]!["id"]).toBe("ai_procurement");
    expect(phases[5]!["id"]).toBe("command_collection");
    expect(phases[6]!["id"]).toBe("appropriation");
    expect(phases[7]!["id"]).toBe("maintenance");
    expect(phases[8]!["id"]).toBe("obligation");
    expect(phases[9]!["id"]).toBe("construction_processing");
    expect(phases[10]!["id"]).toBe("resolve_diplomacy");
    expect(phases[11]!["id"]).toBe("resolve_research");
    expect(phases[12]!["id"]).toBe("resolve_aircraft_development");
    expect(phases[13]!["id"]).toBe("resolve_carrier_operations");
    expect(phases[14]!["id"]).toBe("battle_generation");
    expect(phases[15]!["id"]).toBe("battle_resolution");
    expect(phases[16]!["id"]).toBe("closing_validation");

    for (let i = 0; i < phases.length - 1; i++) {
      expect(phases[i]!["order"]).toBeLessThan(phases[i + 1]!["order"]);
    }
    expect(PhaseRegistry.getById("ai_planning")!["order"]).toBe(1.5);
    expect(PhaseRegistry.getById("resolve_diplomacy")!["order"]).toBe(6.5);
    expect(PhaseRegistry.getById("battle_generation")!["order"]).toBe(7.5);
    // B-5/ADR-0022: weather_generation runs right after opening_validation and
    // before command_collection (order 0.5).
    expect(PhaseRegistry.getById("weather_generation")!["order"]).toBe(0.5);
    expect(PhaseRegistry.getById("weather_generation")!["order"]).toBeGreaterThan(
      PhaseRegistry.getById("opening_validation")!["order"],
    );
    expect(PhaseRegistry.getById("weather_generation")!["order"]).toBeLessThan(
      PhaseRegistry.getById("command_collection")!["order"],
    );
    const constructionIdx = phases.findIndex((p) => p["id"] === "construction_processing")!;
    const diplomacyIdx = phases.findIndex((p) => p["id"] === "resolve_diplomacy")!;
    const researchIdx = phases.findIndex((p) => p["id"] === "resolve_research")!;
    const battleGenIdx = phases.findIndex((p) => p["id"] === "battle_generation")!;
    const battleResIdx = phases.findIndex((p) => p["id"] === "battle_resolution")!;
    expect(diplomacyIdx).toBeGreaterThan(constructionIdx);
    expect(diplomacyIdx).toBeLessThan(researchIdx);
    expect(battleGenIdx).toBeGreaterThan(researchIdx);
    expect(battleGenIdx).toBeLessThan(battleResIdx);
  });

  it("can retrieve phase by id and order", () => {
    const byId = PhaseRegistry.getById("appropriation");
    expect(byId).toBeDefined();
    expect(byId!["name"]).toBe("Appropriation");

    const byOrder = PhaseRegistry.getByOrder(7);
    expect(byOrder).toBeDefined();
    expect(byOrder!["id"]).toBe("resolve_research");
  });

  it("enforces read permissions", () => {
    const app = PhaseRegistry.getById("appropriation")!;
    expect(PhaseRegistry.hasAccess(app, "treasury", "read")).toBe(true);
    expect(PhaseRegistry.hasAccess(app, "fleets", "read")).toBe(false);
  });

  it("enforces write permissions", () => {
    const app = PhaseRegistry.getById("appropriation")!;
    expect(PhaseRegistry.hasAccess(app, "treasury", "write")).toBe(true);
    expect(PhaseRegistry.hasAccess(app, "research", "write")).toBe(false);

    const validate = PhaseRegistry.getById("opening_validation")!;
    expect(PhaseRegistry.hasAccess(validate, "treasury", "write")).toBe(false);
  });

  it("all phases have read access to all", () => {
    const open = PhaseRegistry.getById("opening_validation")!;
    expect(PhaseRegistry.hasAccess(open, "anything", "read")).toBe(true);
  });

  it("only rng phases allow randomness", () => {
    const research = PhaseRegistry.getById("resolve_research")!;
    const battle = PhaseRegistry.getById("battle_resolution")!;
    const battleGen = PhaseRegistry.getById("battle_generation")!;
    const collect = PhaseRegistry.getById("command_collection")!;

    expect(research["rngAllowed"]).toBe(true);
    expect(battle["rngAllowed"]).toBe(true);
    expect(battleGen["rngAllowed"]).toBe(true);
    const aiPlan = PhaseRegistry.getById("ai_planning")!;
    expect(aiPlan["rngAllowed"]).toBe(true);
    expect(collect["rngAllowed"]).toBe(false);
  });
});

describe("PhaseContext", () => {
  it("permissions are enforced through access checks", () => {
    const phase = PhaseRegistry.getById("construction_processing")!;
    expect(PhaseRegistry.hasAccess(phase, "constructions", "read")).toBe(true);
    expect(PhaseRegistry.hasAccess(phase, "fleets", "read")).toBe(true);
    expect(PhaseRegistry.hasAccess(phase, "constructions", "write")).toBe(true);
    expect(PhaseRegistry.hasAccess(phase, "fleets", "write")).toBe(true);
    expect(PhaseRegistry.hasAccess(phase, "treasury", "read")).toBe(false);
    expect(PhaseRegistry.hasAccess(phase, "treasury", "write")).toBe(false);
  });
});

describe("PhaseGuard", () => {
  it("passes a footprint fully within declared permissions", () => {
    const guard = new PhaseGuard();
    const app = PhaseRegistry.getById("appropriation")!;
    const violations = guard.assert(app.id, {
      reads: ["treasury", "constructions"],
      writes: ["treasury", "constructions"],
      usesRng: false,
    });
    expect(violations).toEqual([]);
  });

  it("fails closed when a phase writes a resource it lacks permission for", () => {
    const guard = new PhaseGuard();
    const app = PhaseRegistry.getById("appropriation")!;
    const violations = guard.assert(app.id, {
      reads: [],
      writes: ["fleets"],
      usesRng: false,
    });
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('writes resource "fleets" without write permission');
  });

  it("fails closed when a phase reads a resource it lacks permission for", () => {
    const guard = new PhaseGuard();
    const maintenance = PhaseRegistry.getById("maintenance")!;
    const violations = guard.assert(maintenance.id, {
      reads: ["research"],
      writes: [],
      usesRng: false,
    });
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('reads resource "research" without read permission');
  });

  it("fails closed when a non-rngAllowed phase declares randomness", () => {
    const guard = new PhaseGuard();
    const obligation = PhaseRegistry.getById("obligation")!;
    expect(obligation.rngAllowed).toBe(false);
    const violations = guard.assert(obligation.id, {
      reads: [],
      writes: [],
      usesRng: true,
    });
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("draws randomness but rngAllowed=false");
  });

  it("honors a phase definition override (used to exercise fail-closed)", () => {
    const overrides = new Map([
      ["monthly_revenue", { ...PhaseRegistry.getById("monthly_revenue")!, writePermissions: [] }],
    ]);
    const guard = new PhaseGuard(overrides);
    const violations = guard.assert("monthly_revenue", {
      reads: ["treasury"],
      writes: ["treasury"],
      usesRng: false,
    });
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('writes resource "treasury" without write permission');
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
