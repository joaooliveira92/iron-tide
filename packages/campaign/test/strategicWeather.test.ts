import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildContentBundleArtifact } from "@bluewave/content-compiler";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_RULESETS_JSON, jsonDocument, nationsDocument } from "@bluewave/test-support";
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

const AREAS_3 = jsonDocument([
  { id: "lon", name: "London", type: "land", controller: "uk" },
  { id: "par", name: "Paris", type: "land", controller: "france" },
  { id: "eng_ch", name: "English Channel", type: "sea" },
]);
const AREAS_2 = jsonDocument([
  { id: "lon", name: "London", type: "land", controller: "uk" },
  { id: "par", name: "Paris", type: "land", controller: "france" },
]);
const DEFAULT_ROUTES = `
[
  {
    "id": "lon-par",
    "from": "lon",
    "to": "par",
    "type": "sea",
    "distance": 300
  },
  {
    "id": "lon-eng",
    "from": "lon",
    "to": "eng_ch",
    "type": "sea",
    "distance": 50
  },
  {
    "id": "par-eng",
    "from": "par",
    "to": "eng_ch",
    "type": "sea",
    "distance": 100
  }
]
`;
const ROUTES_2 = `
[
  {
    "id": "lon-par",
    "from": "lon",
    "to": "par",
    "type": "sea",
    "distance": 300
  }
]
`;

function writeFixture(fixturePath: string, areasYaml: string, routesYaml = DEFAULT_ROUTES): void {
  writeFile(
    fixturePath,
    "pack.json",
    JSON.stringify({
      name: "sw-test-scenario",
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
  );
  writeFile(fixturePath, "rulesets.json", FIXTURE_RULESETS_JSON);
  writeFile(
    fixturePath,
    "countries.json",
    nationsDocument([
      { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
      { id: "france", tag: "FRA", name: "France", homeArea: "par" },
    ]),
  );
  writeFile(fixturePath, "areas.json", areasYaml);
  writeFile(fixturePath, "routes.json", routesYaml);
  writeFile(
    fixturePath,
    "possessions.json",
    `
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
  );
  writeFile(
    fixturePath,
    "ports.json",
    `
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
  );
  writeFile(
    fixturePath,
    "technologies.json",
    `
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
  );
  writeFile(
    fixturePath,
    "fleets.json",
    `
[
  {
    "id": "fleet-uk-home",
    "nationId": "uk",
    "name": "Home Fleet",
    "locationAreaId": "lon",
    "ships": [
      {
        "id": "ship-a",
        "name": "A",
        "classId": "battleship",
        "hitPoints": 100,
        "maxHitPoints": 100,
        "speed": 21,
        "firepower": 10,
        "armor": 12,
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
        "id": "ship-b",
        "name": "B",
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
  );
  writeFile(
    fixturePath,
    "economies.json",
    `
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
  );
  writeFile(
    fixturePath,
    "constructions.json",
    `
[
  {
    "id": "con-uk-a",
    "nationId": "uk",
    "type": "ship",
    "targetId": "x",
    "totalWork": 200,
    "completedWork": 50,
    "paidWork": 0,
    "status": "PLANNED",
    "startedAt": "1880-01"
  }
]
`,
  );
  writeFile(
    fixturePath,
    "diplomacy.json",
    `
[
  {
    "nationA": "uk",
    "nationB": "france",
    "relation": "neutral",
    "since": "1880-01"
  }
]
`,
  );
  writeFile(
    fixturePath,
    "research.json",
    `
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
