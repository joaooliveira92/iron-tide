import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { buildContentBundleArtifact } from "@bluewave/content-compiler";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { MonthExecutor } from "@bluewave/phase-engine";
import { FIXTURE_RULESETS_YAML, nationsYaml } from "@bluewave/test-support";

const FIXTURE = {
  pack: JSON.stringify({
    name: "1880-test-carrier-ops",
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
  ]),
  areas: `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n- id: "eng_ch"\n  name: "English Channel"\n  type: "sea"\n`,
  routes: `- id: "lon-eng_ch"\n  from: "lon"\n  to: "eng_ch"\n  type: "sea"\n  distance: 50\n`,
  possessions: `- id: "gbr-lon"\n  nationId: "uk"\n  areaId: "lon"\n`,
  ports: `- id: "port-lon"\n  name: "Port of London"\n  areaId: "lon"\n  nationId: "uk"\n  level: 5\n`,
  technologies: `- id: "basic_steam"\n  name: "Basic Steam Turbine"\n  category: "propulsion"\n  cost: 100\n  year: 1880\n`,
  fleets: `- id: "fleet-gbr-home"\n  nationId: "uk"\n  name: "Home Fleet"\n  locationAreaId: "lon"\n  ships:\n    - id: "ship-hms-carrier"\n      name: "HMS Carrier"\n      classId: "carrier"\n      hitPoints: 100\n      maxHitPoints: 100\n      speed: 21\n      firepower: 2\n      armor: 6\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n`,
  economies: `- nationId: "uk"\n  treasury: 800\n  income: 150\n  expenses: 75\n`,
  constructions: `- id: "con-gbr-ship-carrier2"\n  nationId: "uk"\n  type: "ship"\n  targetId: "ship-hms-carrier2"\n  totalWork: 200\n  completedWork: 50\n  paidWork: 0\n  status: "PLANNED"\n  startedAt: "1880-01"\n`,
  diplomacy: ``,
  research: `- nationId: "uk"\n  researchBudget: 0\n  technologies: []\n`,
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
      diplomacyFiles: [],
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

function carrierOpsHash(snapshot: CampaignSnapshot): string {
  const ops: Record<string, unknown> = {};
  for (const [nationId, nation] of snapshot.nations) {
    const co = (nation["carrierOperations"] ?? {}) as unknown;
    if (typeof co === "object" && co !== null) {
      ops[nationId] = co;
    }
  }
  return sha256Hex(canonicalSerialize(ops));
}

function run(): void {
  const fixtureDir = resolve(
    tmpdir(),
    `bw-co-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(fixtureDir, { recursive: true });
  const saveDir = resolve(
    tmpdir(),
    `bw-co-save-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(saveDir, { recursive: true });

  try {
    writeAllFixtureFiles(fixtureDir);

    const { state: campaignState, contentHash: contentArtifactHash } = compileCampaign(fixtureDir);
    const snapshot = campaignState.snapshot;
    const initialSnapshotHash = campaignState.rawHash;

    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const monthResult = executor.execute(snapshot, [], "deterministic-seed", collector);

    const closingSnapshotHash = hashSnapshot(monthResult.finalSnapshot);
    const commandLedgerHash = monthResult.commandLedger.hash();
    const eventLedgerHash = monthResult.eventLedger.hash();
    const financialLedgerHash = monthResult.financialLedger.hash();
    const randomDecisionLedgerHash = monthResult.randomLedger.hash();
    const carrierOpsResultHash = carrierOpsHash(monthResult.finalSnapshot);

    const output = {
      contentArtifactHash,
      initialSnapshotHash,
      closingSnapshotHash,
      commandLedgerHash,
      eventLedgerHash,
      financialLedgerHash,
      randomDecisionLedgerHash,
      carrierOpsHash: carrierOpsResultHash,
      success: monthResult.success,
    };

    process.stdout.write(JSON.stringify(output) + "\n");
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
    rmSync(saveDir, { recursive: true, force: true });
  }
}

run();
