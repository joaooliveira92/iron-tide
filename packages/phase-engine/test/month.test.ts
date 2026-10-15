import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { BudgetProjectCommand, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, PHASE_FOOTPRINTS, PhaseGuard, PhaseRegistry } from "../src/index.js";

function createSnapshot(overrides?: Partial<CampaignSnapshot>): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set("GBR", {
    id: "GBR",
    name: "United Kingdom",
    tag: "GBR",
    treasury: SafeInt(500),
    income: SafeInt(150),
    expenses: SafeInt(50),
    baseResources: SafeInt(120000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [{ techId: "basic_steam", investedPoints: SafeInt(30), completed: false }],
      currentProjectTechId: "basic_steam",
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [
      {
        id: "proj-1",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "ship-1",
        designVersionId: "",
        totalWork: SafeInt(200),
        completedWork: SafeInt(50),
        paidWork: SafeInt(0),
        status: "ACTIVE",
        startedAt: "1880-01",
      },
      {
        id: "proj-2",
        type: "building",
        projectType: "NEW_CONSTRUCTION",
        targetId: "bldg-1",
        designVersionId: "",
        totalWork: SafeInt(100),
        completedWork: SafeInt(0),
        paidWork: SafeInt(0),
        status: "PLANNED",
        startedAt: "1880-01",
      },
    ],
    isPlayable: true,
    isAI: false,
  });

  const base: CampaignSnapshot = {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "test-campaign-06",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations,
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

  return overrides ? { ...base, ...overrides } : base;
}

function makeBudgetCommand(
  nationId: string,
  projectId: string,
  budget: SafeInt,
  snapshot: CampaignSnapshot,
): CommandEnvelope<BudgetProjectCommand> {
  const hash = sha256Hex(canonicalSerialize(snapshot));
  return {
    commandId: `cmd-${projectId}-${String(budget)}`,
    version: "0.1.0",
    expectedSnapshotHash: hash,
    idempotencyKey: `ik-${projectId}-${String(budget)}`,
    timestamp: "test",
    body: { type: "budget_project", nationId, projectId, budget },
  };
}

describe("MonthExecutor", () => {
  it("executes a full month with a budget command", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result = executor.execute(snapshot, [cmd], "test-seed", collector);

    expect(result["success"]).toBe(true);

    const gbr = result["finalSnapshot"]["nations"].get("GBR")!;
    // treasury = 500 + 2000 (revenue) - 100 (command) - appropriation - 50 (obligation)
    expect(gbr["treasury"] as number).toBeLessThan(500 + 2000);

    const proj1 = gbr["constructionProjects"].find((p) => p["id"] === "proj-1")!;
    expect(proj1["completedWork"] as number).toBeGreaterThan(50);
  });

  it("decreases treasury by at least the budget amount", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result = executor.execute(snapshot, [cmd], "test-seed", collector);
    const gbr = result["finalSnapshot"]["nations"].get("GBR")!;

    const treasury = gbr["treasury"] as number;
    // 500 + 2000 (revenue) - 100 (command) = 2400, then appropriation + obligation
    expect(treasury).toBeLessThanOrEqual(500 + 2000 - 100);
    expect(treasury).toBeGreaterThanOrEqual(0);
  });

  it("increases construction project progress", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result = executor.execute(snapshot, [cmd], "test-seed", collector);
    const gbr = result["finalSnapshot"]["nations"].get("GBR")!;
    const proj1 = gbr["constructionProjects"].find((p) => p["id"] === "proj-1")!;

    expect(proj1["completedWork"] as number).toBeGreaterThan(50);
    expect(proj1["completedWork"] as number).toBeLessThanOrEqual(200);
  });

  it("produces deterministic closing snapshot hash", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result1 = executor.execute(
      snapshot,
      [cmd],
      "deterministic-seed",
      new DiagnosticCollector(),
    );
    const result2 = executor.execute(
      snapshot,
      [cmd],
      "deterministic-seed",
      new DiagnosticCollector(),
    );

    const hash1 = sha256Hex(canonicalSerialize(result1["finalSnapshot"]));
    const hash2 = sha256Hex(canonicalSerialize(result2["finalSnapshot"]));
    expect(hash1).toBe(hash2);
  });

  it("populates all ledgers", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const gbr = snapshot["nations"].get("GBR")!;
    gbr.research.fieldPriorities = { MACHINERY: SafeInt(1) };
    gbr.research.researchBudget = SafeInt(100);
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result = executor.execute(snapshot, [cmd], "test-seed", collector);

    expect(result["commandLedger"]["all"].length).toBeGreaterThan(0);
    expect(result["eventLedger"]["all"].length).toBeGreaterThan(0);
    expect(result["randomLedger"]["all"].length).toBeGreaterThan(0);
    expect(result["financialLedger"]["all"].length).toBeGreaterThan(0);
  });

  it("never produces negative treasury", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result = executor.execute(snapshot, [cmd], "test-seed", collector);
    const gbr = result["finalSnapshot"]["nations"].get("GBR")!;

    expect(gbr["treasury"] as number).toBeGreaterThanOrEqual(0);
  });

  it("construction progress never exceeds total work", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(200), snapshot);

    const result = executor.execute(snapshot, [cmd], "test-seed", collector);
    const gbr = result["finalSnapshot"]["nations"].get("GBR")!;

    for (const proj of gbr["constructionProjects"]) {
      expect(proj["completedWork"] as number).toBeLessThanOrEqual(proj["totalWork"] as number);
    }
  });

  it("same inputs produce identical outputs (determinism)", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(75), snapshot);

    const run = () => executor.execute(snapshot, [cmd], "fixed-seed", new DiagnosticCollector());

    const r1 = run();
    const r2 = run();

    expect(sha256Hex(canonicalSerialize(r1["finalSnapshot"]))).toBe(
      sha256Hex(canonicalSerialize(r2["finalSnapshot"])),
    );
    expect(r1["commandLedger"]["hash"]()).toBe(r2["commandLedger"]["hash"]());
    expect(r1["eventLedger"]["hash"]()).toBe(r2["eventLedger"]["hash"]());
    expect(r1["randomLedger"]["hash"]()).toBe(r2["randomLedger"]["hash"]());
    expect(r1["financialLedger"]["hash"]()).toBe(r2["financialLedger"]["hash"]());
  });

  it("opening validation rejects negative treasury", () => {
    const executor = new MonthExecutor();
    const nations = new Map<string, NationState>();
    nations.set("GBR", {
      id: "GBR",
      name: "UK",
      tag: "GBR",
      treasury: SafeInt(-10),
      income: SafeInt(0),
      expenses: SafeInt(0),
      baseResources: SafeInt(0),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0),
      fleets: [],
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
    });
    const snapshot = createSnapshot({ nations });
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);

    expect(result["success"]).toBe(false);
    const hasNeg = collector.errors.some((d) => d["code"] === "NEGATIVE_TREASURY");
    expect(hasNeg).toBe(true);
  });

  it("outputs FinancialLedger entries with correct shape", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);

    const result = executor.execute(snapshot, [cmd], "seed", collector);
    const entries = result["financialLedger"]["all"];

    expect(entries.length).toBeGreaterThanOrEqual(3);

    for (const entry of entries) {
      expect(entry["nationId"]).toBe("GBR");
      expect(typeof entry["phaseId"]).toBe("string");
      expect(typeof entry["categoryId"]).toBe("string");
      expect(typeof (entry["debit"] as number)).toBe("number");
      expect(typeof (entry["credit"] as number)).toBe("number");
      expect(typeof (entry["previousBalance"] as number)).toBe("number");
      expect(typeof (entry["newBalance"] as number)).toBe("number");
      expect(typeof entry["reason"]).toBe("string");
      expect(typeof entry["transactionId"]).toBe("string");
      expect(typeof entry["preTransactionHash"]).toBe("string");
      expect(typeof entry["postTransactionHash"]).toBe("string");
      expect(entry["debit"]).toBe(entry["credit"]);
    }
  });

  // --- New B10a tests ---

  it("credits monthly revenue from baseResources", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);
    const gbr = result["finalSnapshot"]["nations"].get("GBR")!;

    // revenue = 120000 * 2000 / 10000 / 12 = 2000
    // treasury = 500 + 2000 - 100 (appropriation cap) - 50 (obligation) = 2350
    expect(gbr["treasury"] as number).toBe(2350);
    expect(result["success"]).toBe(true);
  });

  it("deducts maintenance cost for ships in fleet", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const gbr = snapshot["nations"].get("GBR")!;
    gbr.baseResources = SafeInt(120000);
    gbr.treasury = SafeInt(10000);
    gbr.fleets = [
      {
        id: "fleet-gbr",
        nationId: "GBR",
        name: "Grand Fleet",
        locationAreaId: "area-1",
        ships: [
          {
            id: "ship-1",
            name: "HMS Dreadnought",
            classId: "dreadnought",
            nationId: "GBR",
            locationAreaId: "area-1",
            designVersionId: "",
            hitPoints: SafeInt(100),
            maxHitPoints: SafeInt(100),
            speed: SafeInt(10),
            firepower: SafeInt(10),
            armor: SafeInt(10),
            isUnderConstruction: false,
            constructionProgress: SafeInt(100),
            constructionTotalWork: SafeInt(100),
          },
        ],
      },
    ];
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);
    const finalGbr = result["finalSnapshot"]["nations"].get("GBR")!;

    // maintenance = floor(100 * 10 / 100) = 10
    // revenue = 120000 * 2000 / 10000 / 12 = 2000
    // treasury = 10000 + 2000 - 100 (appropriation) - 10 (maintenance) - 50 (obligation) = 11840
    expect(finalGbr["treasury"] as number).toBe(11840);
    expect(finalGbr["maintenanceCost"] as number).toBe(10);
    expect(result["success"]).toBe(true);
  });

  it("promotes completed construction project to fleet ship", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const gbr = snapshot["nations"].get("GBR")!;
    gbr.baseResources = SafeInt(120000);
    gbr.treasury = SafeInt(10000);
    gbr.constructionProjects = [
      {
        id: "proj-complete",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "new-ship-1",
        designVersionId: "",
        totalWork: SafeInt(100),
        completedWork: SafeInt(100),
        paidWork: SafeInt(100),
        status: "ACTIVE",
        startedAt: "1880-01",
      },
    ];
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);
    const finalGbr = result["finalSnapshot"]["nations"].get("GBR")!;

    const completedProj = finalGbr["constructionProjects"].find(
      (p) => p["id"] === "proj-complete",
    )!;
    expect(completedProj["status"]).toBe("COMPLETED");
    expect(completedProj["completedWork"] as number).toBe(100);

    // A fleet should have been created with the new ship
    expect(finalGbr["fleets"].length).toBeGreaterThan(0);
    const fleet = finalGbr["fleets"][0];
    expect(fleet["ships"].length).toBe(1);
    expect(fleet["ships"][0]["isUnderConstruction"]).toBe(false);
    expect(fleet["ships"][0]["classId"]).toBe("new-ship-1");
  });

  it("registry access rules enforced at runtime: a denied write fails closed without mutating", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    // Deny monthly_revenue its treasury write; its runtime footprint requires it.
    const overrides = new Map([
      ["monthly_revenue", { ...PhaseRegistry.getById("monthly_revenue")!, writePermissions: [] }],
    ]);

    const result = executor.execute(snapshot, [], "seed", collector, undefined, {
      phaseOverrides: overrides,
    });

    expect(result.success).toBe(false);
    expect(collector.errors.some((d) => d.code === "PHASE_ACCESS_DENIED")).toBe(true);
    // Fail-closed: the denied phase did not run, so revenue was never applied.
    const gbr = result.finalSnapshot.nations.get("GBR")!;
    expect(gbr.treasury as number).toBe(500);
  });

  it("registry access rules enforced at runtime: a well-formed run is never denied", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const guard = new PhaseGuard();
    const result = executor.execute(snapshot, [], "seed", collector);

    expect(result.success).toBe(true);
    expect(collector.errors.some((d) => d.code === "PHASE_ACCESS_DENIED")).toBe(false);
    // Every phase's authoritative footprint sits within its declared permissions,
    // so a well-formed run is never denied at runtime.
    for (const phase of PhaseRegistry.all) {
      const footprint = PHASE_FOOTPRINTS[phase.id];
      expect(footprint, phase.id).toBeDefined();
      expect(guard.assert(phase.id, footprint), phase.id).toEqual([]);
    }
  });

  it("zero payment produces zero progress (paid-work rule)", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const gbr = snapshot["nations"].get("GBR")!;
    // No base resources => no revenue => no appropriation
    gbr.baseResources = SafeInt(0);
    gbr.treasury = SafeInt(10000);
    gbr.constructionProjects = [
      {
        id: "proj-no-funds",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "ship-x",
        designVersionId: "",
        totalWork: SafeInt(200),
        completedWork: SafeInt(0),
        paidWork: SafeInt(0),
        status: "PLANNED",
        startedAt: "1880-01",
      },
    ];
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);
    const finalGbr = result["finalSnapshot"]["nations"].get("GBR")!;

    const project = finalGbr["constructionProjects"].find((p) => p["id"] === "proj-no-funds")!;
    // No payment allocated => no progress
    expect(project["completedWork"] as number).toBe(0);
    expect(project["paidWork"] as number).toBe(0);
    expect(project["status"]).toBe("PLANNED");
    expect(result["success"]).toBe(true);
  });

  it("includes GER as a third nation with own economy", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const gerNation: NationState = {
      id: "GER",
      name: "Germany",
      tag: "GER",
      treasury: SafeInt(300),
      income: SafeInt(80),
      expenses: SafeInt(20),
      baseResources: SafeInt(60000),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0),
      fleets: [],
      divisions: [],
      research: {
        nationId: "GER",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(0),
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
      constructionProjects: [
        {
          id: "ger-proj-1",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "ger-ship-1",
          designVersionId: "",
          totalWork: SafeInt(150),
          completedWork: SafeInt(0),
          paidWork: SafeInt(0),
          status: "PLANNED",
          startedAt: "1880-01",
        },
      ],
      isPlayable: false,
      isAI: true,
    };
    const nations = new Map(snapshot["nations"]);
    nations.set("GER", gerNation);
    snapshot["nations"] = nations;
    snapshot["slots"] = [...snapshot["slots"], { nationId: "GER", type: "ai" }];
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);
    expect(result["success"]).toBe(true);

    const ger = result["finalSnapshot"]["nations"].get("GER")!;
    expect(ger).toBeDefined();
    // GER revenue = 60000 * 2000 / 10000 / 12 = 1000
    // AI planning budgets 46 to ger-proj-1 (deterministic from seed), then
    // appropriation caps at 50 and obligation subtracts 20:
    // treasury = 300 + 1000 - 46 (AI budget) - 50 (appropriation) - 20 (obligation) = 1184
    expect(ger["treasury"] as number).toBe(1184);
    expect(ger["constructionProjects"].length).toBe(1);
  });

  it("construction capacity cap limits total monthly work", () => {
    const executor = new MonthExecutor();
    const snapshot = createSnapshot();
    const gbr = snapshot["nations"].get("GBR")!;
    // baseResources = 12000 => cap = 12000 / 12 / 100 = 10
    gbr.baseResources = SafeInt(12000);
    gbr.treasury = SafeInt(10000);
    gbr.constructionProjects = [
      {
        id: "proj-cap-1",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "ship-cap-1",
        designVersionId: "",
        totalWork: SafeInt(200),
        completedWork: SafeInt(0),
        paidWork: SafeInt(0),
        status: "PLANNED",
        startedAt: "1880-01",
      },
      {
        id: "proj-cap-2",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "ship-cap-2",
        designVersionId: "",
        totalWork: SafeInt(200),
        completedWork: SafeInt(0),
        paidWork: SafeInt(0),
        status: "PLANNED",
        startedAt: "1880-01",
      },
    ];
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [], "seed", collector);
    const finalGbr = result["finalSnapshot"]["nations"].get("GBR")!;

    const totalWork = finalGbr["constructionProjects"].reduce(
      (sum, p) => sum + (p["completedWork"] as number),
      0,
    );
    // cap = 12000 / 12 / 100 = 10, so total work across both projects <= 10
    expect(totalWork).toBeLessThanOrEqual(10);
    expect(result["success"]).toBe(true);
  });
});
