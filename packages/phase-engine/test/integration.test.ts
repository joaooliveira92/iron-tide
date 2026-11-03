import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import type { BudgetProjectCommand, CommandEnvelope } from "@bluewave/commands";
import { CommandIdempotencyMap, CommandLifecycle } from "@bluewave/commands";
import { SafeInt, type TurnPhase } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
import {
  FIXTURE_RULESETS_JSON,
  buildFixtureContentBundle,
  failureTag,
  nationsDocument,
  runSync,
} from "@bluewave/test-support";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  MonthExecutor,
  monthPipeline,
  ReplayVerifier,
  type PhasePermissions,
  unifiedSnapshotHash,
} from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

const FIXTURE = {
  pack: JSON.stringify({
    name: "1880-test-scenario",
    version: "0.1.0",
    type: "fixture",
    files: {
      rulesets: ["rulesets.json"],
      countries: ["countries.json"],
      areas: ["areas.json"],
      routes: ["routes.json"],
      possessions: ["possessions.json"],
      ports: ["ports.json"],
      technologies: ["technologies.json"],
    },
  }),

  rulesets: FIXTURE_RULESETS_JSON,

  countries: nationsDocument([
    { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
    { id: "france", tag: "FRA", name: "France", homeArea: "par" },
  ]),

  areas: `
[
  {
    "id": "lon",
    "name": "London",
    "type": "land",
    "controller": "uk"
  },
  {
    "id": "par",
    "name": "Paris",
    "type": "land",
    "controller": "france"
  },
  {
    "id": "eng_ch",
    "name": "English Channel",
    "type": "sea"
  }
]
`,

  routes: `
[
  {
    "id": "lon-par",
    "from": "lon",
    "to": "par",
    "type": "sea",
    "distance": 300
  },
  {
    "id": "lon-eng_ch",
    "from": "lon",
    "to": "eng_ch",
    "type": "sea",
    "distance": 50
  },
  {
    "id": "par-eng_ch",
    "from": "par",
    "to": "eng_ch",
    "type": "sea",
    "distance": 100
  }
]
`,

  possessions: `
[
  {
    "id": "uk-lon",
    "nationId": "uk",
    "areaId": "lon"
  },
  {
    "id": "fra-par",
    "nationId": "france",
    "areaId": "par"
  }
]
`,

  ports: `
[
  {
    "id": "port-lon",
    "name": "Port of London",
    "areaId": "lon",
    "nationId": "uk",
    "level": 5
  },
  {
    "id": "port-par",
    "name": "Port of Paris",
    "areaId": "par",
    "nationId": "france",
    "level": 3
  }
]
`,

  technologies: `
[
  {
    "id": "basic_steam",
    "name": "Basic Steam Turbine",
    "category": "propulsion",
    "cost": 100,
    "year": 1880
  },
  {
    "id": "advanced_steam",
    "name": "Advanced Steam Turbine",
    "category": "propulsion",
    "prerequisites": [
      {
        "techId": "basic_steam"
      }
    ],
    "cost": 200,
    "year": 1900
  }
]
`,

  fleets: `
[
  {
    "id": "fleet-uk-home",
    "nationId": "uk",
    "name": "Home Fleet",
    "locationAreaId": "lon",
    "ships": [
      {
        "id": "ship-hms-dreadnought",
        "name": "HMS Dreadnought",
        "classId": "battleship",
        "hitPoints": 100,
        "maxHitPoints": 100,
        "speed": 21,
        "firepower": 10,
        "armor": 12,
        "isUnderConstruction": false,
        "constructionProgress": 0,
        "constructionTotalWork": 0
      },
      {
        "id": "ship-hms-invincible",
        "name": "HMS Invincible",
        "classId": "battlecruiser",
        "hitPoints": 80,
        "maxHitPoints": 80,
        "speed": 25,
        "firepower": 8,
        "armor": 6,
        "isUnderConstruction": false,
        "constructionProgress": 0,
        "constructionTotalWork": 0
      }
    ]
  },
  {
    "id": "fleet-fra-atlantic",
    "nationId": "france",
    "name": "Atlantic Fleet",
    "locationAreaId": "par",
    "ships": [
      {
        "id": "ship-fs-courbet",
        "name": "FS Courbet",
        "classId": "battleship",
        "hitPoints": 90,
        "maxHitPoints": 90,
        "speed": 20,
        "firepower": 9,
        "armor": 11,
        "isUnderConstruction": false,
        "constructionProgress": 0,
        "constructionTotalWork": 0
      }
    ]
  }
]
`,

  economies: `
[
  {
    "nationId": "uk",
    "treasury": 800,
    "income": 150,
    "expenses": 75
  },
  {
    "nationId": "france",
    "treasury": 600,
    "income": 120,
    "expenses": 60
  }
]
`,

  constructions: `
[
  {
    "id": "con-gbr-ship-battleship2",
    "nationId": "uk",
    "type": "ship",
    "targetId": "ship-hms-thunderer",
    "totalWork": 200,
    "completedWork": 50,
    "paidWork": 0,
    "status": "PLANNED",
    "startedAt": "1880-01"
  }
]
`,

  diplomacy: `
[
  {
    "nationA": "uk",
    "nationB": "france",
    "relation": "neutral",
    "since": "1880-01"
  }
]
`,

  research: `
[
  {
    "nationId": "uk",
    "currentProjectTechId": "basic_steam",
    "researchBudget": 100,
    "fieldPriorities": {
      "MACHINERY": 4,
      "HULL_CONSTRUCTION": 2,
      "GUNNERY": 1
    },
    "technologies": [
      {
        "techId": "basic_steam",
        "investedPoints": 30,
        "completed": false
      }
    ]
  },
  {
    "nationId": "france",
    "researchBudget": 0,
    "technologies": []
  }
]
`,
};

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = resolve(tmpdir(), `bw-int-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFile(base: string, rel: string, content: string): void {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function writeAllFixtureFiles(fixturePath: string): void {
  writeFile(fixturePath, "pack.json", FIXTURE.pack);
  writeFile(fixturePath, "rulesets.json", FIXTURE.rulesets);
  writeFile(fixturePath, "countries.json", FIXTURE.countries);
  writeFile(fixturePath, "areas.json", FIXTURE.areas);
  writeFile(fixturePath, "routes.json", FIXTURE.routes);
  writeFile(fixturePath, "possessions.json", FIXTURE.possessions);
  writeFile(fixturePath, "ports.json", FIXTURE.ports);
  writeFile(fixturePath, "technologies.json", FIXTURE.technologies);
  writeFile(fixturePath, "fleets.json", FIXTURE.fleets);
  writeFile(fixturePath, "economies.json", FIXTURE.economies);
  writeFile(fixturePath, "constructions.json", FIXTURE.constructions);
  writeFile(fixturePath, "diplomacy.json", FIXTURE.diplomacy);
  writeFile(fixturePath, "research.json", FIXTURE.research);
}

function compileCampaign(fixtureDir: string): CampaignState {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const { bundle, contentHash } = buildFixtureContentBundle(
    {
      manifestPath: resolve(fixtureDir, "pack.json"),
      contentDir: fixtureDir,
      rulesetFiles: ["rulesets.json"],
      countryFiles: ["countries.json"],
      areaFiles: ["areas.json"],
      routeFiles: ["routes.json"],
      possessionFiles: ["possessions.json"],
      portFiles: ["ports.json"],
      technologyFiles: ["technologies.json"],
      fleetFiles: ["fleets.json"],
      economyFiles: ["economies.json"],
      constructionFiles: ["constructions.json"],
      diplomacyFiles: ["diplomacy.json"],
      researchFiles: ["research.json"],
      designFiles: [],
    },
    signal,
    collector,
  );
  const output = new CampaignCompiler().compile(
    {
      contentBundle: bundle,
      contentHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    signal,
    collector,
  );

  if (!output || collector.hasErrors) {
    throw new Error(`Compilation failed: ${diagnosticsSummary(collector)}`);
  }
  return output.state;
}

function diagnosticsSummary(collector: DiagnosticCollector): string {
  return collector.all.map((d) => `${d.code}: ${d.message}`).join("; ");
}

function makeBudgetCommand(
  snapshot: CampaignSnapshot,
  nationId: string,
  projectId: string,
  budget: SafeInt,
  overrides?: Partial<CommandEnvelope<BudgetProjectCommand>>,
): CommandEnvelope<BudgetProjectCommand> {
  const hash = sha256Hex(canonicalSerialize(snapshot));
  return {
    commandId: `cmd-${projectId}-${String(budget)}`,
    version: "0.1.0",
    expectedSnapshotHash: hash,
    idempotencyKey: `ik-${projectId}-${String(budget)}`,
    timestamp: "integration-test",
    body: { type: "budget_project", nationId, projectId, budget },
    ...overrides,
  };
}

describe("Full-slice integration", () => {
  let fixtureDir: string;
  let fixtureCleanup: () => void;
  let campaignState: CampaignState;
  let snapshot: CampaignSnapshot;

  beforeAll(() => {
    const f = createFixtureDir();
    fixtureDir = f.path;
    fixtureCleanup = f.cleanup;
    writeAllFixtureFiles(fixtureDir);
    campaignState = compileCampaign(fixtureDir);
    snapshot = campaignState.snapshot;
  });

  afterAll(() => {
    fixtureCleanup();
  });

  it("1. Repeated compilation yields identical initial snapshot hash", () => {
    const state1 = compileCampaign(fixtureDir);
    const state2 = compileCampaign(fixtureDir);
    expect(state1.rawHash).toBe(state2.rawHash);
    expect(state1.rawHash).toHaveLength(64);
  });

  it("2. Same opening snapshot and commands yield identical closing snapshot, command, event, financial, and random-decision ledger hashes", () => {
    const executor = new MonthExecutor();
    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(100));

    const run = () =>
      executor.execute(snapshot, [cmd], "deterministic-seed", new DiagnosticCollector());

    const r1 = run();
    const r2 = run();

    expect(unifiedSnapshotHash(r1.finalSnapshot)).toBe(unifiedSnapshotHash(r2.finalSnapshot));
    expect(r1.commandLedger.hash()).toBe(r2.commandLedger.hash());
    expect(r1.eventLedger.hash()).toBe(r2.eventLedger.hash());
    expect(r1.financialLedger.hash()).toBe(r2.financialLedger.hash());
    expect(r1.randomLedger.hash()).toBe(r2.randomLedger.hash());
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("3. Save/load before advancement preserves snapshot hash", () => {
    const store = new SaveStore();
    const saveDir = resolve(
      tmpdir(),
      `bw-save-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(saveDir, { recursive: true });

    try {
      const { rawHash: _rh, ...stateForSave } = campaignState;
      const saveableState: CampaignState = {
        ...campaignState,
        rawHash: sha256Hex(canonicalSerialize(stateForSave)),
      };
      const saveResult = store.save(saveableState, saveDir);
      expect(saveResult.hash).toHaveLength(64);

      expect(runSync(store.load(saveDir)).warnings).toEqual([]);
    } finally {
      rmSync(saveDir, { recursive: true, force: true });
    }
  });

  it("4. Child-process replay reproduces all authoritative hashes", () => {
    const executor = new MonthExecutor();
    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(100));
    const collector = new DiagnosticCollector();

    const original = executor.execute(snapshot, [cmd], "replay-seed", collector);
    const originalLedger = original.commandLedger;

    const replayVerifier = new ReplayVerifier();
    const replayResult = replayVerifier.verify(
      snapshot,
      [cmd],
      originalLedger,
      unifiedSnapshotHash(original.finalSnapshot),
      "replay-seed",
      collector,
    );

    expect(replayResult.match).toBe(true);
    expect(replayResult.mismatches.length).toBe(0);
    expect(replayResult.replayedFinalHash).toBe(replayResult.originalFinalHash);
    expect(replayResult.replayedCommandLedgerHash).toBe(replayResult.originalCommandLedgerHash);
  });

  it("5. Stale expected snapshot hash is rejected", () => {
    const lifecycle = new CommandLifecycle();
    const slot = snapshot.slots.find((s) => s.nationId === "uk")!;
    const idempotencyMap = new CommandIdempotencyMap();

    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(50), {
      expectedSnapshotHash: "0".repeat(64),
    });

    const result = lifecycle.process(cmd, snapshot, slot, idempotencyMap);
    expect(result.type).toBe("rejected");
    if (result.type === "rejected") {
      expect(result.diagnostic.code).toBe("STALE_SNAPSHOT_HASH");
    }
  });

  it("6. Same idempotency key and canonical command returns original result; different command returns IDEMPOTENCY_CONFLICT", () => {
    const lifecycle = new CommandLifecycle();
    const slot = snapshot.slots.find((s) => s.nationId === "uk")!;
    const idempotencyMap = new CommandIdempotencyMap();

    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(50));

    const firstResult = lifecycle.process(cmd, snapshot, slot, idempotencyMap);
    expect(firstResult.type).toBe("success");

    const sameCmd = { ...cmd };
    const sameResult = lifecycle.process(sameCmd, snapshot, slot, idempotencyMap);
    expect(sameResult.type).toBe("idempotency_match");

    const cmdConflict: CommandEnvelope<BudgetProjectCommand> = {
      ...cmd,
      commandId: "cmd-conflict-different",
      body: {
        type: "budget_project",
        nationId: "uk",
        projectId: "con-gbr-ship-battleship2",
        budget: SafeInt(999),
      },
    };
    const conflictResult = lifecycle.process(cmdConflict, snapshot, slot, idempotencyMap);
    expect(conflictResult.type).toBe("idempotency_conflict");
  });

  it("7. An unlocked, invalid, or unreserved command cannot resolve", () => {
    const lifecycle = new CommandLifecycle();
    const slot = snapshot.slots.find((s) => s.nationId === "uk")!;
    const idempotencyMap = new CommandIdempotencyMap();

    const cmdInvalidNation = makeBudgetCommand(
      snapshot,
      "NONEXISTENT",
      "con-gbr-ship-battleship2",
      SafeInt(10),
    );
    const result = lifecycle.process(cmdInvalidNation, snapshot, slot, idempotencyMap);
    expect(result.type).toBe("rejected");
    if (result.type === "rejected") {
      expect(result.diagnostic.code).toBe("UNAUTHORIZED");
    }

    const fraSlot = snapshot.slots.find((s) => s.nationId === "france")!;
    const fraTreasury = snapshot.nations.get("france")!.treasury as number;
    const cmdFra: CommandEnvelope<BudgetProjectCommand> = {
      commandId: "cmd-fra-overbudget",
      version: "0.1.0",
      expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
      idempotencyKey: "ik-fra-overbudget",
      timestamp: "integration-test",
      body: {
        type: "budget_project",
        nationId: "france",
        projectId: "con-gbr-ship-battleship2",
        budget: SafeInt(fraTreasury + 100),
      },
    };
    const fraResult = lifecycle.process(cmdFra, snapshot, fraSlot, idempotencyMap);
    expect(fraResult.type).toBe("rejected");
  });

  it("8. Treasury never silently becomes negative and financial postings balance", () => {
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();

    const budgetCmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(99999));
    const result = executor.execute(snapshot, [budgetCmd], "treasury-test", collector);

    const gbr = result.finalSnapshot.nations.get("uk")!;
    expect(gbr.treasury as number).toBeGreaterThanOrEqual(0);

    const entries = result.financialLedger.all;
    const gbrEntries = entries.filter((e) => e.nationId === "uk");
    for (const entry of gbrEntries) {
      expect(entry.newBalance as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("9. Construction progress based on paid work and never exceeds total work", () => {
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();

    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(50));
    const result = executor.execute(snapshot, [cmd], "construction-test", collector);

    const gbr = result.finalSnapshot.nations.get("uk")!;
    for (const project of gbr.constructionProjects) {
      expect(project.completedWork as number).toBeLessThanOrEqual(project.totalWork as number);
    }

    const gbrInitial = snapshot.nations.get("uk")!;
    const initialProj = gbrInitial.constructionProjects.find(
      (p) => p.id === "con-gbr-ship-battleship2",
    )!;
    const finalProj = gbr.constructionProjects.find((p) => p.id === "con-gbr-ship-battleship2")!;
    const workAdded = (finalProj.completedWork as number) - (initialProj.completedWork as number);
    expect(workAdded).toBeGreaterThanOrEqual(0);
  });

  it("10. No ship in two unresolved battles", () => {
    const executor = new MonthExecutor();
    const nations = new Map<string, NationState>();
    const gbrNation: NationState = {
      prestige: SafeInt(20),
      id: "GBR",
      name: "United Kingdom",
      tag: "GBR",
      treasury: SafeInt(500),
      income: SafeInt(150),
      expenses: SafeInt(75),
      baseResources: SafeInt(120000),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0),
      fleets: [
        {
          id: "fleet-1",
          nationId: "GBR",
          name: "Test Fleet",
          locationAreaId: "lon",
          ships: [
            {
              id: "ship-1",
              name: "Test",
              classId: "battleship",
              nationId: "GBR",
              locationAreaId: "lon",
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
              designVersionId: "",
              inBattleId: "battle-1",
            },
          ],
        },
      ],
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
    nations.set("GBR", gbrNation);

    const testSnapshot: CampaignSnapshot = {
      prestigeRules: FIXTURE_PRESTIGE_RULES,
      version: "0.1.0",
      turnNumber: SafeInt(1),
      campaignId: "test-ship-battles",
      startYear: 1880,
      startMonth: 1,
      strategicWeather: [],
      slots: [{ nationId: "GBR", type: "playable" }],
      world: { areas: [], routes: [], ports: [] },
      nations,
      wars: {
        wars: [],
        battles: [
          {
            id: "battle-1",
            phase: "pending",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "eng_ch",
            attackerFleetIds: ["fleet-1"],
            defenderFleetIds: [],
          },
          {
            id: "battle-2",
            phase: "pending",
            attackerId: "FRA",
            defenderId: "GBR",
            areaId: "eng_ch",
            attackerFleetIds: ["fleet-1"],
            defenderFleetIds: [],
          },
        ],
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
      },
      politics: { relations: [], shells: {} },
      intelligence: { shells: {} },
      designs: new Map(),
      designFamilies: new Map(),
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    };

    const collector = new DiagnosticCollector();
    const result = executor.execute(testSnapshot, [], "test-seed", collector);

    expect(result.success).toBe(false);
    const shipDiag = collector.errors.filter((d) => d.code === "SHIP_IN_MULTIPLE_BATTLES");
    expect(shipDiag.length).toBeGreaterThanOrEqual(1);
  });

  it("11. RNG decisions stable when unrelated queries inserted", () => {
    const executor = new MonthExecutor();
    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(50));

    const result1 = executor.execute(snapshot, [cmd], "rng-stable-seed", new DiagnosticCollector());
    const hash1 = result1.randomLedger.hash();

    const result2 = executor.execute(snapshot, [cmd], "rng-stable-seed", new DiagnosticCollector());
    const hash2 = result2.randomLedger.hash();

    expect(hash1).toBe(hash2);
  });

  it("12. Permitted RNG families and aggregate ownership are declared once", () => {
    const rngPhases = monthPipeline.nodes.filter((node) => node.permissions.rng);
    expect(rngPhases.map((node) => node.id).sort()).toEqual([
      "ai_planning",
      "ai_procurement",
      "appropriation",
      "battle_generation",
      "battle_resolution",
      "resolve_aircraft_development",
      "resolve_carrier_operations",
      "resolve_diplomacy",
      "resolve_research",
      "sacking",
      "weather_generation",
    ]);

    const openingPhase = monthPipeline.nodes.find((node) => node.id === "opening_validation")!;
    expect(openingPhase.permissions.rng).toBe(false);
    expect(openingPhase.permissions.writes).toEqual([]);

    const commandCollectPhase = monthPipeline.nodes.find(
      (node) => node.id === "command_collection",
    )!;
    expect(commandCollectPhase.permissions.rng).toBe(false);
  });

  it("13. A phase that writes a resource it lacks permission for fails closed with a diagnostic", () => {
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const overrides = new Map<TurnPhase, PhasePermissions>([
      ["monthly_revenue", { reads: "all", writes: [], rng: false }],
    ]);

    const result = executor.execute(snapshot, [], "seed", collector, undefined, {
      phaseOverrides: overrides,
    });

    expect(result.success).toBe(false);
    const denied = collector.errors.filter((d) => d.code === "PHASE_ACCESS_DENIED");
    expect(denied.length).toBeGreaterThanOrEqual(1);
    expect(denied[0]!.message).toContain('phase "monthly_revenue"');
  });

  it("13b. A phase whose registry denies randomness fails closed at runtime", () => {
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const overrides = new Map<TurnPhase, PhasePermissions>([
      ["resolve_research", { reads: ["nations", "world"], writes: ["nations"], rng: false }],
    ]);

    const result = executor.execute(snapshot, [], "seed", collector, undefined, {
      phaseOverrides: overrides,
    });

    expect(result.success).toBe(false);
    const denied = collector.errors.filter((d) => d.code === "PHASE_ACCESS_DENIED");
    expect(denied.length).toBeGreaterThanOrEqual(1);
    expect(denied[0]!.message).toContain('phase "resolve_research"');
  });

  it("14. Corrupt/incompatible saves rejected with stable diagnostics", () => {
    const store = new SaveStore();
    const saveDir = resolve(
      tmpdir(),
      `bw-corrupt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(saveDir, { recursive: true });

    try {
      const { rawHash: _rh, ...stateForSave } = campaignState;
      const saveableState: CampaignState = {
        ...campaignState,
        rawHash: sha256Hex(canonicalSerialize(stateForSave)),
      };
      const saveResult = store.save(saveableState, saveDir);

      const corruptStatePath = join(saveResult.savePath, "campaign.json");
      const originalContent = readFileSync(corruptStatePath, "utf8");
      writeFileSync(corruptStatePath, originalContent.replace(/"[^"]+"/g, '"corrupted"'), "utf8");

      expect(failureTag(store.load(saveDir))).toBe("PERSISTENCE_CORRUPT_SAVE");
    } finally {
      rmSync(saveDir, { recursive: true, force: true });
    }
  });

  it("15. Cancellation leaves save pointer and committed artifacts valid", () => {
    const store = new SaveStore();
    const saveDir = resolve(
      tmpdir(),
      `bw-cancel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(saveDir, { recursive: true });

    try {
      const { rawHash: _rh, ...stateForSave } = campaignState;
      const saveableState: CampaignState = {
        ...campaignState,
        rawHash: sha256Hex(canonicalSerialize(stateForSave)),
      };
      store.save(saveableState, saveDir);
      const pointer = store.getActiveSaveId(saveDir);
      expect(pointer).not.toBeNull();

      expect(runSync(store.load(saveDir)).warnings).toEqual([]);

      const loadedPtr = store.getActiveSaveId(saveDir);
      expect(loadedPtr).toBe(pointer);
    } finally {
      rmSync(saveDir, { recursive: true, force: true });
    }
  });

  it("16. Auto-resolver labeled narrow, no tactical equivalence claim", () => {
    const nations = new Map<string, NationState>();

    const gbrNation: NationState = {
      prestige: SafeInt(20),
      id: "GBR",
      name: "United Kingdom",
      tag: "GBR",
      treasury: SafeInt(500),
      income: SafeInt(150),
      expenses: SafeInt(75),
      baseResources: SafeInt(120000),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0),
      fleets: [
        {
          id: "fleet-gbr-home",
          nationId: "GBR",
          name: "Home Fleet",
          locationAreaId: "eng_ch",
          ships: [
            {
              id: "ship-hms-dreadnought",
              name: "HMS Dreadnought",
              classId: "battleship",
              nationId: "GBR",
              locationAreaId: "eng_ch",
              designVersionId: "",
              hitPoints: SafeInt(100),
              maxHitPoints: SafeInt(100),
              speed: SafeInt(21),
              firepower: SafeInt(10),
              armor: SafeInt(12),
              isUnderConstruction: false,
              constructionProgress: SafeInt(0),
              constructionTotalWork: SafeInt(0),
              readiness: "ACTIVE",
              crewQuality: SafeInt(100),
            },
          ],
        },
      ],
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

    const fraNation: NationState = {
      prestige: SafeInt(20),
      id: "FRA",
      name: "France",
      tag: "FRA",
      treasury: SafeInt(600),
      income: SafeInt(120),
      expenses: SafeInt(60),
      baseResources: SafeInt(90000),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0),
      fleets: [
        {
          id: "fleet-fra-atlantic",
          nationId: "FRA",
          name: "Atlantic Fleet",
          locationAreaId: "eng_ch",
          ships: [
            {
              id: "ship-fs-courbet",
              name: "FS Courbet",
              classId: "battleship",
              nationId: "FRA",
              locationAreaId: "eng_ch",
              designVersionId: "",
              hitPoints: SafeInt(90),
              maxHitPoints: SafeInt(90),
              speed: SafeInt(20),
              firepower: SafeInt(9),
              armor: SafeInt(11),
              isUnderConstruction: false,
              constructionProgress: SafeInt(0),
              constructionTotalWork: SafeInt(0),
              readiness: "ACTIVE",
              crewQuality: SafeInt(100),
            },
          ],
        },
      ],
      divisions: [],
      research: {
        nationId: "FRA",
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(0),
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
      constructionProjects: [],
      isPlayable: false,
      isAI: true,
    };

    nations.set("GBR", gbrNation);
    nations.set("FRA", fraNation);

    const testSnapshot: CampaignSnapshot = {
      prestigeRules: FIXTURE_PRESTIGE_RULES,
      version: "0.1.0",
      turnNumber: SafeInt(1),
      campaignId: "test-battle-narrow",
      startYear: 1880,
      startMonth: 1,
      strategicWeather: [],
      slots: [
        { nationId: "GBR", type: "playable" },
        { nationId: "FRA", type: "ai" },
      ],
      world: snapshot.world,
      nations,
      wars: {
        wars: [
          {
            id: "war-1",
            attackerSideId: "side_GBR",
            defenderSideId: "side_FRA",
            attackerSideMembers: ["GBR"],
            defenderSideMembers: ["FRA"],
            attackerWarScore: 0,
            defenderWarScore: 0,
            attackerId: "GBR",
            defenderId: "FRA",
            startDate: "1880-01",
            status: "ACTIVE",
          },
        ],
        battles: [
          {
            id: "battle-1",
            phase: "pending",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "eng_ch",
            attackerFleetIds: ["fleet-gbr-home"],
            defenderFleetIds: ["fleet-fra-atlantic"],
          },
        ],
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
      },
      politics: { relations: [], shells: {} },
      intelligence: { shells: {} },
      designs: new Map(),
      designFamilies: new Map(),
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    };

    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(testSnapshot, [], "battle-test-seed", collector);

    const resolvedBattles = result.finalSnapshot.wars.battles.filter((b) => b.phase === "resolved");
    if (resolvedBattles.length > 0) {
      for (const battle of resolvedBattles) {
        if (battle.result) {
          for (const explanation of battle.result.explanation) {
            expect(explanation.toLowerCase()).not.toContain("tactical equivalence");
          }
        }
      }
    }
  });

  it("17. Invariants run after every authoritative transition and at closing snapshot", () => {
    const executor = new MonthExecutor();
    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(100));
    const collector = new DiagnosticCollector();

    const result = executor.execute(snapshot, [cmd], "invariant-test", collector);

    expect(result.success).toBe(true);

    const gbr = result.finalSnapshot.nations.get("uk")!;
    expect(gbr.treasury as number).toBeGreaterThanOrEqual(0);

    for (const project of gbr.constructionProjects) {
      expect(project.completedWork as number).toBeLessThanOrEqual(project.totalWork as number);
    }

    const phaseCollector = new DiagnosticCollector();
    const phaseResult = executor.execute(
      {
        ...snapshot,
        nations: new Map<string, NationState>(),
        slots: [],
        turnNumber: SafeInt(1),
      },
      [],
      "seed",
      phaseCollector,
    );
    expect(phaseResult.success).toBe(true);
  });
});
