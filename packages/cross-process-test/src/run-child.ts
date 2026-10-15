import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { generateBattles } from "@bluewave/combat";
import type { BudgetProjectCommand, CommandEnvelope } from "@bluewave/commands";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
import { MonthExecutor, ReplayVerifier } from "@bluewave/phase-engine";
import { nationsYaml } from "@bluewave/test-support";

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
  rulesets: `- id: "core"\n  name: "Core Rules"\n  version: "1.0"\n`,
  countries: nationsYaml([
    { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true },
    { id: "france", tag: "FRA", name: "France" },
  ]),
  areas: `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n- id: "eng_ch"\n  name: "English Channel"\n  type: "sea"\n`,
  routes: `- id: "lon-par"\n  from: "lon"\n  to: "par"\n  type: "sea"\n  distance: 300\n- id: "lon-eng_ch"\n  from: "lon"\n  to: "eng_ch"\n  type: "sea"\n  distance: 50\n- id: "par-eng_ch"\n  from: "par"\n  to: "eng_ch"\n  type: "sea"\n  distance: 100\n`,
  possessions: `- id: "gbr-lon"\n  nationId: "uk"\n  areaId: "lon"\n- id: "fra-par"\n  nationId: "france"\n  areaId: "par"\n`,
  ports: `- id: "port-lon"\n  name: "Port of London"\n  areaId: "lon"\n  nationId: "uk"\n  level: 5\n- id: "port-par"\n  name: "Port of Paris"\n  areaId: "par"\n  nationId: "france"\n  level: 3\n`,
  technologies: `- id: "basic_steam"\n  name: "Basic Steam Turbine"\n  category: "propulsion"\n  cost: 100\n  year: 1880\n- id: "advanced_steam"\n  name: "Advanced Steam Turbine"\n  category: "propulsion"\n  prerequisites:\n    - { techId: "basic_steam" }\n  cost: 200\n  year: 1900\n`,
  fleets: `- id: "fleet-gbr-home"\n  nationId: "uk"\n  name: "Home Fleet"\n  locationAreaId: "lon"\n  ships:\n    - id: "ship-hms-dreadnought"\n      name: "HMS Dreadnought"\n      classId: "battleship"\n      hitPoints: 100\n      maxHitPoints: 100\n      speed: 21\n      firepower: 10\n      armor: 12\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n    - id: "ship-hms-invincible"\n      name: "HMS Invincible"\n      classId: "battlecruiser"\n      hitPoints: 80\n      maxHitPoints: 80\n      speed: 25\n      firepower: 8\n      armor: 6\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n- id: "fleet-fra-atlantic"\n  nationId: "france"\n  name: "Atlantic Fleet"\n  locationAreaId: "par"\n  ships:\n    - id: "ship-fs-courbet"\n      name: "FS Courbet"\n      classId: "battleship"\n      hitPoints: 90\n      maxHitPoints: 90\n      speed: 20\n      firepower: 9\n      armor: 11\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n`,
  economies: `- nationId: "uk"\n  treasury: 800\n  income: 150\n  expenses: 75\n- nationId: "france"\n  treasury: 600\n  income: 120\n  expenses: 60\n`,
  constructions: `- id: "con-gbr-ship-battleship2"\n  nationId: "uk"\n  type: "ship"\n  targetId: "ship-hms-thunderer"\n  totalWork: 200\n  completedWork: 50\n  paidWork: 0\n  status: "PLANNED"\n  startedAt: "1880-01"\n`,
  diplomacy: `- nationA: "uk"\n  nationB: "france"\n  relation: "neutral"\n  since: "1880-01"\n`,
  research: `- nationId: "uk"\n  researchBudget: 0\n  currentProjectTechId: "basic_steam"\n  technologies:\n    - { techId: "basic_steam", investedPoints: 30, completed: false }\n- nationId: "france"\n  researchBudget: 0\n  technologies: []\n`,
};

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

function compileCampaign(fixtureDir: string): { state: CampaignState; contentHash: string } {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const artifact = buildContentBundleArtifact(
    {
      manifestPath: "pack.json",
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
  if (!artifact || collector.hasErrors) {
    throw new Error(`Compilation failed`);
  }
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    signal,
    collector,
  );

  if (!output || collector.hasErrors) {
    throw new Error(`Compilation failed`);
  }
  return { state: output.state, contentHash: output.contentHash };
}

/**
 * Hashes the full-surface content bundle the compiler produces (the compiler's
 * canonical order, plus any ship-building/campaign surface the manifest
 * declares). Part of the cross-process determinism proof so a locale-dependent
 * ordering in the compiler surfaces as a two-process mismatch (CAH-DET-1).
 */
function contentBundleHash(fixtureDir: string): string {
  const collector = new DiagnosticCollector();
  const surfaceInput = buildFullSurfaceInput(resolve(fixtureDir, "pack.json"), fixtureDir);
  if (!surfaceInput) throw new Error("Content surface input failed");
  const artifact = buildContentBundleArtifact(
    surfaceInput,
    new AbortController().signal,
    collector,
  );
  if (!artifact || collector.hasErrors) {
    throw new Error("Content bundle build failed");
  }
  return artifact.envelope.bodyHash;
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
    // B-6/ADR-0025: canonical start date + current-month per-area weather are
    // part of the authoritative snapshot surface (golden keys must prove the
    // schema carries them — hash parity with ReplayVerifier's subset hash).
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

function makeBudgetCommand(
  snapshot: CampaignSnapshot,
  nationId: string,
  projectId: string,
  budget: SafeInt,
): CommandEnvelope<BudgetProjectCommand> {
  const hash = sha256Hex(canonicalSerialize(snapshot));
  return {
    commandId: `cmd-${projectId}-${String(budget)}`,
    version: "0.1.0",
    expectedSnapshotHash: hash,
    idempotencyKey: `ik-${projectId}-${String(budget)}`,
    timestamp: "cross-process-test",
    body: { type: "budget_project", nationId, projectId, budget },
  };
}

// Deterministic battle-generation scenario: co-located opposing active-war
// surface presence (ADR B-1-7) produces a manifest + battle seed. Hash the
// resulting seeds to prove cross-process byte-identical generation.
function battleGenerationHash(snapshot: CampaignSnapshot): string {
  const nations = new Map<string, NationState>();
  for (const [id, nation] of snapshot.nations) {
    const fleets = nation.fleets.map((f) => ({
      ...f,
      locationAreaId: "eng_ch",
      ships: f.ships.map((s) => ({ ...s, locationAreaId: "eng_ch" })),
    }));
    nations.set(id, { ...nation, fleets });
  }
  const genSnapshot: CampaignSnapshot = {
    ...snapshot,
    nations,
    wars: {
      wars: [
        {
          id: "war_1",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: ["uk"],
          defenderSideMembers: ["france"],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: "uk",
          defenderId: "france",
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
  };
  const result = generateBattles({
    snapshot: genSnapshot,
    campaignMonth: "1880-02",
    campaignSeed: "deterministic-seed",
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: "1",
    contentVersion: "0.1.0",
    resolveStrength: () => 300,
    resolveShipType: () => "BB",
    resolveReadiness: () => 80,
  });
  return sha256Hex(
    canonicalSerialize({
      accepted: result.battleIds,
      seeds: result.manifests.map((m) => m.battleSeed),
      hashes: result.manifests.map((m) => m.manifestHash),
      rejections: result.rejections,
    }),
  );
}

function run(): void {
  const fixtureDir = resolve(
    tmpdir(),
    `bw-cp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(fixtureDir, { recursive: true });
  const saveDir = resolve(
    tmpdir(),
    `bw-cp-save-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(saveDir, { recursive: true });

  try {
    writeAllFixtureFiles(fixtureDir);

    const { state: campaignState, contentHash: contentArtifactHash } = compileCampaign(fixtureDir);
    const snapshot = campaignState.snapshot;
    const initialSnapshotHash = campaignState.rawHash;

    const executor = new MonthExecutor();
    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(100));
    const collector = new DiagnosticCollector();
    const monthResult = executor.execute(snapshot, [cmd], "deterministic-seed", collector);

    const closingSnapshotHash = hashSnapshot(monthResult.finalSnapshot);
    const commandLedgerHash = monthResult.commandLedger.hash();
    const eventLedgerHash = monthResult.eventLedger.hash();
    const financialLedgerHash = monthResult.financialLedger.hash();
    const randomDecisionLedgerHash = monthResult.randomLedger.hash();

    const store = new SaveStore();
    const { rawHash: _rh, ...stateForSave } = campaignState;
    const saveableState: CampaignState = {
      ...campaignState,
      rawHash: sha256Hex(canonicalSerialize(stateForSave)),
    };
    store.save(saveableState, saveDir);

    const loadDiag = new DiagnosticCollector();
    const loaded = store.load(saveDir, loadDiag);
    if (!loaded || loadDiag.hasErrors) {
      throw new Error("Save/load failed");
    }

    const replayVerifier = new ReplayVerifier();
    const replayResult = replayVerifier.verify(
      snapshot,
      [cmd],
      monthResult.commandLedger,
      closingSnapshotHash,
      "deterministic-seed",
      collector,
    );

    const replayVerificationHash = replayResult.match
      ? sha256Hex(
          canonicalSerialize({
            match: true,
            replayedFinalHash: replayResult.replayedFinalHash,
            originalFinalHash: replayResult.originalFinalHash,
            replayedCommandLedgerHash: replayResult.replayedCommandLedgerHash,
            originalCommandLedgerHash: replayResult.originalCommandLedgerHash,
          }),
        )
      : "REPLAY_MISMATCH";

    const generatedBattleHash = battleGenerationHash(snapshot);
    const generatedContentBundleHash = contentBundleHash(fixtureDir);

    // Output all hashes as JSON
    const output = {
      contentArtifactHash,
      contentBundleHash: generatedContentBundleHash,
      initialSnapshotHash,
      closingSnapshotHash,
      commandLedgerHash,
      eventLedgerHash,
      financialLedgerHash,
      randomDecisionLedgerHash,
      replayVerificationHash,
      battleGenerationHash: generatedBattleHash,
      success: monthResult.success && replayResult.match,
    };

    process.stdout.write(JSON.stringify(output) + "\n");
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
    rmSync(saveDir, { recursive: true, force: true });
  }
}

run();
