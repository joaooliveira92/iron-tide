import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { unifiedSnapshotHash } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { buildContentBundleArtifact } from "@bluewave/content-compiler";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { MonthExecutor } from "@bluewave/phase-engine";
import { FIXTURE_RULESETS_JSON, nationsDocument } from "@bluewave/test-support";

const FIXTURE = {
  pack: JSON.stringify({
    name: "1880-test-carrier-ops",
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
    "id": "eng_ch",
    "name": "English Channel",
    "type": "sea"
  }
]
`,
  routes: `
[
  {
    "id": "lon-eng_ch",
    "from": "lon",
    "to": "eng_ch",
    "type": "sea",
    "distance": 50
  }
]
`,
  possessions: `
[
  {
    "id": "gbr-lon",
    "nationId": "uk",
    "areaId": "lon"
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
        "id": "ship-hms-carrier",
        "name": "HMS Carrier",
        "classId": "carrier",
        "hitPoints": 100,
        "maxHitPoints": 100,
        "speed": 21,
        "firepower": 2,
        "armor": 6,
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
  }
]
`,
  constructions: `
[
  {
    "id": "con-gbr-ship-carrier2",
    "nationId": "uk",
    "type": "ship",
    "targetId": "ship-hms-carrier2",
    "totalWork": 200,
    "completedWork": 50,
    "paidWork": 0,
    "status": "PLANNED",
    "startedAt": "1880-01"
  }
]
`,
  diplomacy: ``,
  research: `
[
  {
    "nationId": "uk",
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
      diplomacyFiles: [],
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

    const closingSnapshotHash = unifiedSnapshotHash(monthResult.finalSnapshot);
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
