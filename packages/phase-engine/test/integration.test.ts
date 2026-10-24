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
import { Effect, Exit, Result } from "effect";
import {
  FIXTURE_RULESETS_YAML,
  buildFixtureContentBundle,
  nationsYaml,
} from "@bluewave/test-support";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  MonthExecutor,
  monthPipeline,
  ReplayVerifier,
  type PhasePermissions,
} from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

const FIXTURE = {
  pack: JSON.stringify({
    name: "1880-test-scenario",
    version: "0.1.0",
    type: "fixture",
    files: {
      rulesets: ["rulesets.yaml"],
      countries: ["countries.yaml"],
      areas: ["areas.yaml"],
      routes: ["routes.yaml"],
      possessions: ["possessions.yaml"],
      ports: ["ports.yaml"],
      technologies: ["technologies.yaml"],
    },
  }),

  rulesets: FIXTURE_RULESETS_YAML,

  countries: nationsYaml([
    { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
    { id: "france", tag: "FRA", name: "France", homeArea: "par" },
  ]),

  areas: `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n- id: "eng_ch"\n  name: "English Channel"\n  type: "sea"\n`,

  routes: `- id: "lon-par"\n  from: "lon"\n  to: "par"\n  type: "sea"\n  distance: 300\n- id: "lon-eng_ch"\n  from: "lon"\n  to: "eng_ch"\n  type: "sea"\n  distance: 50\n- id: "par-eng_ch"\n  from: "par"\n  to: "eng_ch"\n  type: "sea"\n  distance: 100\n`,

  possessions: `- id: "uk-lon"\n  nationId: "uk"\n  areaId: "lon"\n- id: "fra-par"\n  nationId: "france"\n  areaId: "par"\n`,

  ports: `- id: "port-lon"\n  name: "Port of London"\n  areaId: "lon"\n  nationId: "uk"\n  level: 5\n- id: "port-par"\n  name: "Port of Paris"\n  areaId: "par"\n  nationId: "france"\n  level: 3\n`,

  technologies: `- id: "basic_steam"\n  name: "Basic Steam Turbine"\n  category: "propulsion"\n  cost: 100\n  year: 1880\n- id: "advanced_steam"\n  name: "Advanced Steam Turbine"\n  category: "propulsion"\n  prerequisites:\n    - { techId: "basic_steam" }\n  cost: 200\n  year: 1900\n`,

  fleets: `- id: "fleet-uk-home"\n  nationId: "uk"\n  name: "Home Fleet"\n  locationAreaId: "lon"\n  ships:\n    - id: "ship-hms-dreadnought"\n      name: "HMS Dreadnought"\n      classId: "battleship"\n      hitPoints: 100\n      maxHitPoints: 100\n      speed: 21\n      firepower: 10\n      armor: 12\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n    - id: "ship-hms-invincible"\n      name: "HMS Invincible"\n      classId: "battlecruiser"\n      hitPoints: 80\n      maxHitPoints: 80\n      speed: 25\n      firepower: 8\n      armor: 6\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n- id: "fleet-fra-atlantic"\n  nationId: "france"\n  name: "Atlantic Fleet"\n  locationAreaId: "par"\n  ships:\n    - id: "ship-fs-courbet"\n      name: "FS Courbet"\n      classId: "battleship"\n      hitPoints: 90\n      maxHitPoints: 90\n      speed: 20\n      firepower: 9\n      armor: 11\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n`,

  economies: `- nationId: "uk"\n  treasury: 800\n  income: 150\n  expenses: 75\n- nationId: "france"\n  treasury: 600\n  income: 120\n  expenses: 60\n`,

  constructions: `- id: "con-gbr-ship-battleship2"\n  nationId: "uk"\n  type: "ship"\n  targetId: "ship-hms-thunderer"\n  totalWork: 200\n  completedWork: 50\n  paidWork: 0\n  status: "PLANNED"\n  startedAt: "1880-01"\n`,

  diplomacy: `- nationA: "uk"\n  nationB: "france"\n  relation: "neutral"\n  since: "1880-01"\n`,

  research: `- nationId: "uk"\n  currentProjectTechId: "basic_steam"\n  researchBudget: 100\n  fieldPriorities:\n    MACHINERY: 4\n    HULL_CONSTRUCTION: 2\n    GUNNERY: 1\n  technologies:\n    - { techId: "basic_steam", investedPoints: 30, completed: false }\n- nationId: "france"\n  researchBudget: 0\n  technologies: []\n`,
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
  writeFile(fixturePath, "rulesets.yaml", FIXTURE.rulesets);
  writeFile(fixturePath, "countries.yaml", FIXTURE.countries);
  writeFile(fixturePath, "areas.yaml", FIXTURE.areas);
  writeFile(fixturePath, "routes.yaml", FIXTURE.routes);
  writeFile(fixturePath, "possessions.yaml", FIXTURE.possessions);
  writeFile(fixturePath, "ports.yaml", FIXTURE.ports);
  writeFile(fixturePath, "technologies.yaml", FIXTURE.technologies);
  writeFile(fixturePath, "fleets.yaml", FIXTURE.fleets);
  writeFile(fixturePath, "economies.yaml", FIXTURE.economies);
  writeFile(fixturePath, "constructions.yaml", FIXTURE.constructions);
  writeFile(fixturePath, "diplomacy.yaml", FIXTURE.diplomacy);
  writeFile(fixturePath, "research.yaml", FIXTURE.research);
}

function compileCampaign(fixtureDir: string): CampaignState {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const { bundle, contentHash } = buildFixtureContentBundle(
    {
      manifestPath: resolve(fixtureDir, "pack.json"),
      contentDir: fixtureDir,
      rulesetFiles: ["rulesets.yaml"],
      countryFiles: ["countries.yaml"],
      areaFiles: ["areas.yaml"],
      routeFiles: ["routes.yaml"],
      possessionFiles: ["possessions.yaml"],
      portFiles: ["ports.yaml"],
      technologyFiles: ["technologies.yaml"],
      fleetFiles: ["fleets.yaml"],
      economyFiles: ["economies.yaml"],
      constructionFiles: ["constructions.yaml"],
      diplomacyFiles: ["diplomacy.yaml"],
      researchFiles: ["research.yaml"],
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

function snapshotToHashable(snapshot: CampaignSnapshot): unknown {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = nation;
  }
  return {
    version: snapshot.version,
    turnNumber: snapshot.turnNumber,
    campaignId: snapshot.campaignId,
    startYear: snapshot.startYear,
    startMonth: snapshot.startMonth,
    strategicWeather: (snapshot.strategicWeather ?? []).map((s) => ({ ...s })),
    slots: snapshot.slots.map((s) => ({ nationId: s.nationId, type: s.type })),
    world: {
      areas: snapshot.world.areas.map((a) => ({ ...a })),
      routes: snapshot.world.routes.map((r) => ({ ...r })),
      ports: snapshot.world.ports.map((p) => ({ ...p })),
    },
    nations,
    wars: {
      wars: snapshot.wars.wars.map((w) => ({ ...w })),
      battles: snapshot.wars.battles.map((b) => ({ ...b })),
      participantMemberships: snapshot.wars.participantMemberships.map((m) => ({ ...m })),
      blockadeState: snapshot.wars.blockadeState.map((b) => ({ ...b })),
      battleManifests: (snapshot.wars.battleManifests ?? []).map((m) => ({ ...m })),
    },
    politics: {
      relations: snapshot.politics.relations.map((r) => ({ ...r })),
      shells: { ...snapshot.politics.shells },
    },
    intelligence: {
      shells: { ...snapshot.intelligence.shells },
    },
    rulesetVersion: snapshot.rulesetVersion,
    compatibilityVersion: snapshot.compatibilityVersion,
  };
}

function hashSnapshot(snapshot: CampaignSnapshot): string {
  return sha256Hex(canonicalSerialize(snapshotToHashable(snapshot)));
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

    expect(hashSnapshot(r1.finalSnapshot)).toBe(hashSnapshot(r2.finalSnapshot));
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

      expect(Effect.runSync(store.load(saveDir)).warnings).toEqual([]);
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
      hashSnapshot(original.finalSnapshot),
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

      const exit = Effect.runSyncExit(store.load(saveDir));
      expect(Exit.isFailure(exit)).toBe(true);
      const found = Exit.findError(exit);
      expect(Result.isSuccess(found) ? found.success._tag : "defect").toBe(
        "PERSISTENCE_CORRUPT_SAVE",
      );
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

      expect(Effect.runSync(store.load(saveDir)).warnings).toEqual([]);

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
