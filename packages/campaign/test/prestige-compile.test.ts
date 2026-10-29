import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  createFixtureDir,
  FIXTURE_NATION_PRESTIGE,
  FIXTURE_PRESTIGE_VALUE_SET,
  jsonDocument,
  nationsDocument,
  rulesetRecord,
  rulesetsDocument,
  writeFixture,
  type FixtureDir,
} from "@bluewave/test-support";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CampaignCompiler } from "../src/compiler-public.js";
import { PRESTIGE_COMPILE_CODES } from "../src/prestige.js";

const FILES = {
  pack: JSON.stringify({
    name: "prestige-fixture",
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
  areas: jsonDocument([
    { id: "lon", name: "London", type: "land", controller: "uk" },
    { id: "par", name: "Paris", type: "land", controller: "france" },
  ]),
  routes: jsonDocument([{ id: "lon-par", from: "lon", to: "par", type: "sea", distance: 300 }]),
  possessions: jsonDocument([
    { id: "gbr-lon", nationId: "uk", areaId: "lon" },
    { id: "fra-par", nationId: "france", areaId: "par" },
  ]),
  ports: jsonDocument([
    { id: "port-lon", name: "Port of London", areaId: "lon", nationId: "uk", level: 5 },
  ]),
  technologies: jsonDocument([
    {
      id: "basic_steam",
      name: "Basic Steam Turbine",
      category: "propulsion",
      cost: 100,
      year: 1880,
    },
  ]),
  economies: jsonDocument([
    { nationId: "uk", treasury: 800, income: 150, expenses: 75 },
    { nationId: "france", treasury: 600, income: 120, expenses: 60 },
  ]),
  fleets: jsonDocument([]),
  constructions: jsonDocument([]),
  diplomacy: jsonDocument([
    { nationA: "uk", nationB: "france", relation: "neutral", since: "1880-01" },
  ]),
  research: jsonDocument([]),
};

interface Variant {
  readonly uk?: { prestige?: unknown; omitPrestige?: boolean };
  readonly france?: { prestige?: unknown; omitPrestige?: boolean };
  readonly rulesets?: string;
}

let fixture: FixtureDir | undefined;
afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
});

function baseInput(dir: string): CompilerInput {
  return {
    manifestPath: resolve(dir, "pack.json"),
    contentDir: dir,
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
  };
}

function compile(variant: Variant = {}) {
  fixture = createFixtureDir(
    resolve(tmpdir(), `bw-prestige-${Math.random().toString(36).slice(2)}`),
  );
  const dir = fixture.path;
  const countries = nationsDocument([
    {
      id: "uk",
      tag: "GBR",
      name: "United Kingdom",
      isPlayable: true,
      homeArea: "lon",
      ...variant.uk,
    },
    { id: "france", tag: "FRA", name: "France", homeArea: "par", ...variant.france },
  ]);
  writeFixture(dir, "pack.json", FILES.pack);
  writeFixture(dir, "rulesets.json", variant.rulesets ?? rulesetsDocument());
  writeFixture(dir, "countries.json", countries);
  for (const name of [
    "areas",
    "routes",
    "possessions",
    "ports",
    "technologies",
    "economies",
    "fleets",
    "constructions",
    "diplomacy",
    "research",
  ] as const) {
    writeFixture(dir, `${name}.json`, FILES[name]);
  }
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const artifact = buildContentBundleArtifact(baseInput(dir), signal, collector);
  if (!artifact) return { collector, output: undefined };
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: "4.0.0",
    },
    signal,
    collector,
  );
  return { collector, output };
}

const codes = (collector: DiagnosticCollector) =>
  collector.all.filter((d) => d.severity === "error").map((d) => d.code as string);

describe("S-2 ticket 03: prestige at the campaign compile boundary", () => {
  it("compiles every nation's authored prestige into the snapshot as a branded integer", () => {
    const { collector, output } = compile({ uk: { prestige: 33 }, france: { prestige: 7 } });
    expect(collector.hasErrors).toBe(false);
    const nations = output?.state.snapshot.nations;
    expect(nations?.get("uk")?.prestige).toBe(33);
    expect(nations?.get("france")?.prestige).toBe(7);
  });

  it("carries the decoded value set on the snapshot", () => {
    const { output } = compile();
    expect(output?.state.snapshot.prestigeRules).toEqual(FIXTURE_PRESTIGE_VALUE_SET);
  });

  it("accepts a start exactly at either bound", () => {
    for (const prestige of [0, 100]) {
      const { collector } = compile({ uk: { prestige } });
      expect(collector.hasErrors, `prestige ${String(prestige)}`).toBe(false);
    }
  });

  it("fails with a named diagnostic when a nation has no prestige, and does not default it", () => {
    const { collector, output } = compile({ uk: { omitPrestige: true } });
    expect(codes(collector)).toContain(PRESTIGE_COMPILE_CODES.missing);
    expect(output).toBeUndefined();
    const diagnostic = collector.all.find((d) => d.code === PRESTIGE_COMPILE_CODES.missing);
    expect(diagnostic?.entityId).toBe("uk");
  });

  it("fails with named diagnostics for a non-integer, an unsafe and an out-of-range prestige", () => {
    const cases: [unknown, string][] = [
      [20.5, PRESTIGE_COMPILE_CODES.notInteger],
      [1e20, PRESTIGE_COMPILE_CODES.unsafeInteger],
      [-1, PRESTIGE_COMPILE_CODES.outOfRange],
      [101, PRESTIGE_COMPILE_CODES.outOfRange],
    ];
    for (const [prestige, code] of cases) {
      const { collector, output } = compile({ france: { prestige } });
      expect(codes(collector), `prestige ${String(prestige)}`).toContain(code);
      expect(output).toBeUndefined();
      expect(collector.all.find((d) => d.code === code)?.entityId).toBe("france");
    }
  });

  it("names every bad nation, not just the first", () => {
    const { collector } = compile({ uk: { prestige: -5 }, france: { prestige: 500 } });
    const bad = collector.all
      .filter((d) => d.code === PRESTIGE_COMPILE_CODES.outOfRange)
      .map((d) => d.entityId)
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(bad).toEqual(["france", "uk"]);
  });

  it("fails when the ruleset carries no prestige value set", () => {
    const { collector, output } = compile({ rulesets: rulesetsDocument({ prestige: "omit" }) });
    expect(codes(collector)).toContain(PRESTIGE_COMPILE_CODES.valueSetMissing);
    expect(output).toBeUndefined();
  });

  it("fails with the offending field named when the value set is malformed", () => {
    const bad = { ...FIXTURE_PRESTIGE_VALUE_SET, sackingProbabilityBp: 12_000 };
    const { collector, output } = compile({ rulesets: rulesetsDocument({ prestige: bad }) });
    const diagnostic = collector.all.find((d) => d.code === PRESTIGE_COMPILE_CODES.valueSetInvalid);
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain("sackingProbabilityBp");
    expect(output).toBeUndefined();
  });

  it("rejects an excess key in the value set", () => {
    const bad = { ...FIXTURE_PRESTIGE_VALUE_SET, bonus: 1 };
    const { collector } = compile({ rulesets: rulesetsDocument({ prestige: bad }) });
    const diagnostic = collector.all.find((d) => d.code === PRESTIGE_COMPILE_CODES.valueSetInvalid);
    expect(diagnostic?.message).toContain("bonus");
  });

  it("is ambiguous, not guessed, when two rulesets both carry a value set", () => {
    const two = jsonDocument([rulesetRecord(), { ...rulesetRecord(), id: "other" }]);
    const { collector, output } = compile({ rulesets: two });
    expect(codes(collector)).toContain(PRESTIGE_COMPILE_CODES.valueSetAmbiguous);
    expect(output).toBeUndefined();
  });

  it("validates a nation's start against the bounds the value set declares", () => {
    const wide = { ...FIXTURE_PRESTIGE_VALUE_SET, upperBound: 1_000 };
    const { collector } = compile({
      uk: { prestige: 500 },
      rulesets: rulesetsDocument({ prestige: wide }),
    });
    expect(collector.hasErrors).toBe(false);
  });

  it("compiles to byte-identical state twice", () => {
    const first = compile({ uk: { prestige: FIXTURE_NATION_PRESTIGE } });
    const second = compile({ uk: { prestige: FIXTURE_NATION_PRESTIGE } });
    expect(first.output?.state.rawHash).toBeDefined();
    expect(first.output?.state.rawHash).toBe(second.output?.state.rawHash);
  });

  it("reflects a changed authored prestige in the compiled nation", () => {
    const a = compile({ uk: { prestige: 20 } });
    const b = compile({ uk: { prestige: 21 } });
    expect(a.output?.state.snapshot.nations.get("uk")?.prestige).toBe(20);
    expect(b.output?.state.snapshot.nations.get("uk")?.prestige).toBe(21);
  });
});
