import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildContentBundleArtifact } from "@bluewave/content-compiler";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_RULESETS_YAML, nationsYaml } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { CampaignCompiler } from "../src/compiler-public.js";
import type { CampaignSnapshot } from "../src/state.js";
import { campaignMonthId, monthId } from "../src/timeline.js";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = resolve(tmpdir(), `bw-sw-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return { path: dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function writeFile(base: string, rel: string, content: string): void {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

const AREAS_3 =
  `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n` +
  `- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n` +
  `- id: "eng_ch"\n  name: "English Channel"\n  type: "sea"\n`;
const AREAS_2 =
  `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n` +
  `- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n`;
const DEFAULT_ROUTES = `- id: "lon-par"\n  from: "lon"\n  to: "par"\n  type: "sea"\n  distance: 300\n- id: "lon-eng"\n  from: "lon"\n  to: "eng_ch"\n  type: "sea"\n  distance: 50\n- id: "par-eng"\n  from: "par"\n  to: "eng_ch"\n  type: "sea"\n  distance: 100\n`;
const ROUTES_2 = `- id: "lon-par"\n  from: "lon"\n  to: "par"\n  type: "sea"\n  distance: 300\n`;

function writeFixture(fixturePath: string, areasYaml: string, routesYaml = DEFAULT_ROUTES): void {
  writeFile(
    fixturePath,
    "pack.json",
    JSON.stringify({
      name: "sw-test-scenario",
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
  );
  writeFile(fixturePath, "rulesets.yaml", FIXTURE_RULESETS_YAML);
  writeFile(
    fixturePath,
    "countries.yaml",
    nationsYaml([
      { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
      { id: "france", tag: "FRA", name: "France", homeArea: "par" },
    ]),
  );
  writeFile(fixturePath, "areas.yaml", areasYaml);
  writeFile(fixturePath, "routes.yaml", routesYaml);
  writeFile(
    fixturePath,
    "possessions.yaml",
    `- id: "gbr-lon"\n  nationId: "uk"\n  areaId: "lon"\n- id: "fra-par"\n  nationId: "france"\n  areaId: "par"\n`,
  );
  writeFile(
    fixturePath,
    "ports.yaml",
    `- id: "port-lon"\n  name: "Port of London"\n  areaId: "lon"\n  nationId: "uk"\n  level: 5\n- id: "port-par"\n  name: "Port of Paris"\n  areaId: "par"\n  nationId: "france"\n  level: 3\n`,
  );
  writeFile(
    fixturePath,
    "technologies.yaml",
    `- id: "basic_steam"\n  name: "Basic Steam Turbine"\n  category: "propulsion"\n  cost: 100\n  year: 1880\n`,
  );
  writeFile(
    fixturePath,
    "fleets.yaml",
    `- id: "fleet-uk-home"\n  nationId: "uk"\n  name: "Home Fleet"\n  locationAreaId: "lon"\n  ships:\n    - id: "ship-a"\n      name: "A"\n      classId: "battleship"\n      hitPoints: 100\n      maxHitPoints: 100\n      speed: 21\n      firepower: 10\n      armor: 12\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n- id: "fleet-fra-atlantic"\n  nationId: "france"\n  name: "Atlantic Fleet"\n  locationAreaId: "par"\n  ships:\n    - id: "ship-b"\n      name: "B"\n      classId: "battleship"\n      hitPoints: 90\n      maxHitPoints: 90\n      speed: 20\n      firepower: 9\n      armor: 11\n      isUnderConstruction: false\n      constructionProgress: 0\n      constructionTotalWork: 0\n`,
  );
  writeFile(
    fixturePath,
    "economies.yaml",
    `- nationId: "uk"\n  treasury: 800\n  income: 150\n  expenses: 75\n- nationId: "france"\n  treasury: 600\n  income: 120\n  expenses: 60\n`,
  );
  writeFile(
    fixturePath,
    "constructions.yaml",
    `- id: "con-uk-a"\n  nationId: "uk"\n  type: "ship"\n  targetId: "x"\n  totalWork: 200\n  completedWork: 50\n  paidWork: 0\n  status: "PLANNED"\n  startedAt: "1880-01"\n`,
  );
  writeFile(
    fixturePath,
    "diplomacy.yaml",
    `- nationA: "uk"\n  nationB: "france"\n  relation: "neutral"\n  since: "1880-01"\n`,
  );
  writeFile(
    fixturePath,
    "research.yaml",
    `- nationId: "uk"\n  researchBudget: 0\n  currentProjectTechId: "basic_steam"\n  technologies:\n    - { techId: "basic_steam", investedPoints: 30, completed: false }\n- nationId: "france"\n  researchBudget: 0\n  technologies: []\n`,
  );
}

function compileFixture(
  fixturePath: string,
  overrides: { campaignStart?: { startYear: number; startMonth: number } } = {},
): { snapshot: CampaignSnapshot; rawHash: string } {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const artifact = buildContentBundleArtifact(
    {
      manifestPath: resolve(fixturePath, "pack.json"),
      contentDir: fixturePath,
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
  if (!artifact) {
    throw new Error(`Compilation failed: ${collector.all.map((d) => d.message).join("; ")}`);
  }
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: "1.0.0",
      campaignStart: overrides.campaignStart,
    },
    signal,
    collector,
  );
  if (!output || collector.hasErrors) {
    throw new Error(`Compilation failed: ${collector.all.map((d) => d.message).join("; ")}`);
  }
  return { snapshot: output.state.snapshot, rawHash: output.state.rawHash };
}

describe("B-6 strategic weather snapshot surface (campaign)", () => {
  it("compiled snapshot stamps the canonical default start (1880-01) and an empty strategicWeather collection", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(fixture.path, AREAS_3);
      const { snapshot } = compileFixture(fixture.path);
      expect(snapshot.startYear).toBe(1880);
      expect(snapshot.startMonth).toBe(1);
      expect(snapshot.strategicWeather).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  it("campaignStart input stamps the compiled start (scenario start routing)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(fixture.path, AREAS_3);
      const { snapshot } = compileFixture(fixture.path, {
        campaignStart: { startYear: 1935, startMonth: 1 },
      });
      expect(snapshot.startYear).toBe(1935);
      expect(snapshot.startMonth).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  it("a malformed campaignStart fails compilation with INVALID_CAMPAIGN_START", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(fixture.path, AREAS_3);
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;
      const artifact = buildContentBundleArtifact(
        {
          manifestPath: resolve(fixture.path, "pack.json"),
          contentDir: fixture.path,
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
      expect(artifact).toBeDefined();
      new CampaignCompiler().compile(
        {
          contentBundle: artifact!.bundle,
          contentHash: artifact!.envelope.bodyHash,
          rulesetVersion: "1.0",
          compatibilityVersion: "1.0.0",
          campaignStart: { startYear: 1900, startMonth: 13 },
        },
        signal,
        collector,
      );
      expect(collector.hasErrors).toBe(true);
      expect(collector.errors.some((d) => d.code === "INVALID_CAMPAIGN_START")).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("the canonical hash changes when the area set changes (serializer carries the mesh)", () => {
    const fixtureThree = createFixtureDir();
    const fixtureTwo = createFixtureDir();
    try {
      writeFixture(fixtureThree.path, AREAS_3);
      writeFixture(fixtureTwo.path, AREAS_2, ROUTES_2);
      const three = compileFixture(fixtureThree.path);
      const two = compileFixture(fixtureTwo.path);
      const areaIds = (snapshot: CampaignSnapshot): string[] =>
        snapshot.world.areas.map((a) => a.id).sort();
      expect(areaIds(three.snapshot)).toEqual(["eng_ch", "lon", "par"]);
      expect(areaIds(two.snapshot)).toEqual(["lon", "par"]);
      expect(three.rawHash).not.toBe(two.rawHash);
    } finally {
      fixtureThree.cleanup();
      fixtureTwo.cleanup();
    }
  });

  it("is deterministic across two compilations from the same content", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(fixture.path, AREAS_3);
      const a = compileFixture(fixture.path);
      const b = compileFixture(fixture.path);
      expect(a.rawHash).toBe(b.rawHash);
      expect(canonicalSerialize(a.snapshot)).toBe(canonicalSerialize(b.snapshot));
      expect(sha256Hex(canonicalSerialize(a.snapshot))).toBe(
        sha256Hex(canonicalSerialize(b.snapshot)),
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("campaignMonthId walks 12 months as ordered YYYY-MM ids (year wrap)", () => {
    const ids: string[] = [];
    for (let turn = 0; turn < 24; turn++) {
      ids.push(campaignMonthId(1880, 1, turn));
    }
    expect(ids.slice(0, 12)).toEqual([
      "1880-01",
      "1880-02",
      "1880-03",
      "1880-04",
      "1880-05",
      "1880-06",
      "1880-07",
      "1880-08",
      "1880-09",
      "1880-10",
      "1880-11",
      "1880-12",
    ]);
    expect(ids[12]).toBe("1881-01");
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! > ids[i - 1]!).toBe(true);
    }
  });

  it("campaignMonthId is deterministic and monthId zero-pads", () => {
    expect(monthId(1880, 2)).toBe("1880-02");
    expect(monthId(0, 12)).toBe("0000-12");
    expect(campaignMonthId(1935, 1, 1)).toBe("1935-02");
    expect(campaignMonthId(1880, 1, 0)).toBe("1880-01");
    expect(campaignMonthId(1880, 1, 0)).toBe(campaignMonthId(1880, 1, 0));
  });
});
