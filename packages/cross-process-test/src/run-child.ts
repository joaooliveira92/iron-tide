import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { unifiedSnapshotHash } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { generate } from "@bluewave/combat";
import type { BudgetProjectCommand, CommandEnvelope } from "@bluewave/commands";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
import { MonthExecutor, ReplayVerifier } from "@bluewave/phase-engine";
import { Effect, Result } from "effect";
import { FIXTURE_RULESETS_JSON, nationsDocument } from "@bluewave/test-support";

import { buildProgressionLedger } from "./progression-ledger.js";
import { assertDecisionProbes, probeDecisions } from "./decision-probes.js";
import {
  compileProductionBundle,
  compileProductionCampaign,
  probeReferenceDesigns,
} from "./production-pack.js";

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
    "id": "gbr-lon",
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
    "id": "fleet-gbr-home",
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
    "researchBudget": 0,
    "currentProjectTechId": "basic_steam",
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

function compileCampaign(fixtureDir: string): { state: CampaignState; contentHash: string } {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const artifact = buildContentBundleArtifact(
    {
      manifestPath: "pack.json",
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
  const result = generate({
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
    const initialSnapshotHash = unifiedSnapshotHash(snapshot);

    const executor = new MonthExecutor();
    const cmd = makeBudgetCommand(snapshot, "uk", "con-gbr-ship-battleship2", SafeInt(100));
    const collector = new DiagnosticCollector();
    const monthResult = executor.execute(snapshot, [cmd], "deterministic-seed", collector);

    const closingSnapshotHash = unifiedSnapshotHash(monthResult.finalSnapshot);
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

    const loaded = Effect.runSync(Effect.result(store.load(saveDir)));
    if (Result.isFailure(loaded)) {
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

const PRODUCTION_SMOKE_MONTHS = 12;
const PRODUCTION_SMOKE_SEED = "ten-nation-smoke-1880";
const PRODUCTION_TEN_YEAR_MONTHS = 120;
const PRODUCTION_TEN_YEAR_SEED = "ten-year-progression-1880";
interface SmokeDiagnostic {
  readonly month: number;
  readonly nationId: string | null;
  readonly code: string;
  readonly message: string;
}

function nationIdOf(diagnostic: { readonly message: string }): string | null {
  const match = /^Nation (\S+) /.exec(diagnostic.message);
  return match?.[1] ?? null;
}

function hullCounts(snapshot: CampaignSnapshot): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [nationId, nation] of snapshot.nations) {
    counts[nationId] = nation.fleets.reduce((total, fleet) => total + fleet.ships.length, 0);
  }
  return counts;
}

interface YearStart {
  readonly year: number;
  readonly month: string;
  readonly snapshotHash: string;
}

interface ProductionRun {
  readonly initialSnapshotHash: string;
  readonly yearStarts: YearStart[];
  readonly monthlyHashes: string[];
  readonly monthlySuccess: boolean[];
  readonly closingSnapshotHash: string;
  readonly success: boolean;
  readonly diagnostics: SmokeDiagnostic[];
  readonly firstShortfallMonth: Record<string, number>;
  readonly firstDeficitMonth: Record<string, number>;
  readonly ledgerIdentityBreaks: string[];
  readonly hullCounts: Record<string, number>;
}

function calendarAt(
  initial: CampaignSnapshot,
  monthOffset: number,
): {
  readonly year: number;
  readonly month: number;
} {
  const startIndex = Number(initial.startYear) * 12 + Number(initial.startMonth) - 1;
  const index = startIndex + monthOffset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function advanceProductionRun(
  initial: CampaignSnapshot,
  months: number,
  seed: string,
  onYearStart?: (snapshot: CampaignSnapshot, year: number) => void,
): ProductionRun {
  let snapshot = initial;
  const yearStarts: YearStart[] = [];
  const monthlyHashes: string[] = [];
  const monthlySuccess: boolean[] = [];
  const diagnostics: SmokeDiagnostic[] = [];
  const firstShortfallMonth: Record<string, number> = {};
  const firstDeficitMonth: Record<string, number> = {};
  const ledgerIdentityBreaks: string[] = [];
  let success = true;
  for (let index = 0; index < months; index++) {
    const calendar = calendarAt(initial, index);
    if (calendar.month === 1) {
      yearStarts.push({
        year: calendar.year,
        month: `${String(calendar.year)}-01`,
        snapshotHash: unifiedSnapshotHash(snapshot),
      });
      onYearStart?.(snapshot, calendar.year);
    }
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(
      snapshot,
      [],
      `${seed}:month:${String(snapshot.turnNumber)}`,
      collector,
    );
    success = success && result.success;
    monthlySuccess.push(result.success);
    for (const diagnostic of collector.errors) {
      diagnostics.push({
        month: index + 1,
        nationId: nationIdOf(diagnostic),
        code: diagnostic.code,
        message: diagnostic.message,
      });
    }
    for (const warning of collector.warnings) {
      const nationId = warning.code === "OUTFLOW_SHORTFALL" ? nationIdOf(warning) : null;
      if (nationId !== null && firstShortfallMonth[nationId] === undefined)
        firstShortfallMonth[nationId] = index + 1;
    }
    for (const nationId of snapshot.nations.keys()) {
      let revenue = 0;
      let requested = 0;
      for (const entry of result.financialLedger.all) {
        if (entry.nationId !== nationId) continue;
        if (entry.phaseId === "monthly_revenue") revenue += entry.credit as number;
        else if (entry.phaseId !== "appropriation")
          requested += (entry.requested ?? entry.debit) as number;
      }
      if (revenue - requested < 0 && firstDeficitMonth[nationId] === undefined)
        firstDeficitMonth[nationId] = index + 1;
    }
    for (const [nationId, before] of snapshot.nations) {
      let net = 0;
      for (const entry of result.financialLedger.all) {
        if (entry.nationId !== nationId) continue;
        const credits = entry.phaseId === "monthly_revenue" ? entry.credit : 0;
        const debits = entry.phaseId === "monthly_revenue" ? 0 : entry.debit;
        net += (credits as number) - (debits as number);
      }
      const after = result.finalSnapshot.nations.get(nationId);
      if (after !== undefined && (after.treasury as number) !== (before.treasury as number) + net)
        ledgerIdentityBreaks.push(`${String(index + 1)}:${nationId}`);
    }
    monthlyHashes.push(unifiedSnapshotHash(result.finalSnapshot));
    snapshot = {
      ...result.finalSnapshot,
      turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
    };
  }
  return {
    initialSnapshotHash: unifiedSnapshotHash(initial),
    yearStarts,
    monthlyHashes,
    monthlySuccess,
    closingSnapshotHash: unifiedSnapshotHash(snapshot),
    success,
    diagnostics,
    firstShortfallMonth,
    firstDeficitMonth,
    ledgerIdentityBreaks,
    hullCounts: hullCounts(snapshot),
  };
}

function advanceProductionSmoke(initial: CampaignSnapshot): ProductionRun {
  return advanceProductionRun(initial, PRODUCTION_SMOKE_MONTHS, PRODUCTION_SMOKE_SEED);
}

function runProductionTenNationSmoke(): void {
  const { state } = compileProductionCampaign();
  const first = advanceProductionSmoke(state.snapshot);
  const second = advanceProductionSmoke(state.snapshot);
  const inProcessRepeatMatches =
    canonicalSerialize(first.monthlyHashes) === canonicalSerialize(second.monthlyHashes) &&
    first.closingSnapshotHash === second.closingSnapshotHash &&
    canonicalSerialize(first.diagnostics) === canonicalSerialize(second.diagnostics);

  process.stdout.write(
    JSON.stringify({
      mode: "production-ten-nation",
      months: PRODUCTION_SMOKE_MONTHS,
      inProcessRepeatMatches,
      success: first.success && second.success,
      monthlyHashes: first.monthlyHashes,
      monthlySuccess: first.monthlySuccess,
      closingSnapshotHash: first.closingSnapshotHash,
      diagnostics: first.diagnostics,
      firstShortfallMonth: first.firstShortfallMonth,
      firstDeficitMonth: first.firstDeficitMonth,
      ledgerIdentityBreaks: first.ledgerIdentityBreaks,
      hullCounts: first.hullCounts,
    }) + "\n",
  );
}

function runProgressionLedger(): void {
  const { bundle } = compileProductionBundle();
  const ledger = buildProgressionLedger(bundle);
  process.stdout.write(
    JSON.stringify({
      mode: "progression-ledger",
      ledgerHash: sha256Hex(canonicalSerialize(ledger)),
      ledger,
    }) + "\n",
  );
}

function runProductionTenYear(): void {
  const { state } = compileProductionCampaign();
  const first = advanceProductionRun(
    state.snapshot,
    PRODUCTION_TEN_YEAR_MONTHS,
    PRODUCTION_TEN_YEAR_SEED,
  );
  const second = advanceProductionRun(
    state.snapshot,
    PRODUCTION_TEN_YEAR_MONTHS,
    PRODUCTION_TEN_YEAR_SEED,
  );
  const inProcessRepeatMatches =
    canonicalSerialize(first.monthlyHashes) === canonicalSerialize(second.monthlyHashes) &&
    first.closingSnapshotHash === second.closingSnapshotHash &&
    canonicalSerialize(first.diagnostics) === canonicalSerialize(second.diagnostics);

  process.stdout.write(
    JSON.stringify({
      mode: "production-ten-year",
      months: PRODUCTION_TEN_YEAR_MONTHS,
      inProcessRepeatMatches,
      success: first.success && second.success,
      initialSnapshotHash: first.initialSnapshotHash,
      yearlyCheckpoints: first.yearStarts,
      monthlyHashes: first.monthlyHashes,
      monthlySuccess: first.monthlySuccess,
      closingSnapshotHash: first.closingSnapshotHash,
      diagnostics: first.diagnostics,
      firstShortfallMonth: first.firstShortfallMonth,
      firstDeficitMonth: first.firstDeficitMonth,
      ledgerIdentityBreaks: first.ledgerIdentityBreaks,
      hullCounts: first.hullCounts,
    }) + "\n",
  );
}

function runProductionProbes(): void {
  const { bundle, state } = compileProductionCampaign();
  const slot = state.snapshot.slots.find((candidate) => candidate.type === "playable");
  if (slot === undefined) throw new Error("production pack has no playable slot");
  const references = probeReferenceDesigns(bundle);
  const years: { year: number; probes: readonly unknown[] }[] = [];
  const run = advanceProductionRun(
    state.snapshot,
    PRODUCTION_TEN_YEAR_MONTHS,
    PRODUCTION_TEN_YEAR_SEED,
    (snapshot, year) => {
      if (year > 1889) return;
      const probes = probeDecisions(snapshot, slot, year, references);
      assertDecisionProbes(year, probes);
      years.push({ year, probes });
    },
  );
  process.stdout.write(
    JSON.stringify({
      mode: "production-probes",
      years,
      closingSnapshotHash: run.closingSnapshotHash,
    }) + "\n",
  );
}

if (process.argv[2] === "production-ten-nation") {
  runProductionTenNationSmoke();
} else if (process.argv[2] === "production-ten-year") {
  runProductionTenYear();
} else if (process.argv[2] === "production-probes") {
  runProductionProbes();
} else if (process.argv[2] === "progression-ledger") {
  runProgressionLedger();
} else {
  run();
}
