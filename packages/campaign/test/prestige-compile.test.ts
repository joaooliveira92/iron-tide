import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  createFixtureDir,
  FIXTURE_NATION_PRESTIGE,
  FIXTURE_PRESTIGE_VALUE_SET,
  nationsYaml,
  rulesetsYaml,
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
      rulesets: ["rulesets.yaml"],
      countries: ["countries.yaml"],
      areas: ["areas.yaml"],
      routes: ["routes.yaml"],
      possessions: ["possessions.yaml"],
      ports: ["ports.yaml"],
      technologies: ["technologies.yaml"],
    },
  }),
  areas: `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n`,
  routes: `- id: "lon-par"\n  from: "lon"\n  to: "par"\n  type: "sea"\n  distance: 300\n`,
  possessions: `- id: "gbr-lon"\n  nationId: "uk"\n  areaId: "lon"\n- id: "fra-par"\n  nationId: "france"\n  areaId: "par"\n`,
  ports: `- id: "port-lon"\n  name: "Port of London"\n  areaId: "lon"\n  nationId: "uk"\n  level: 5\n`,
  technologies: `- id: "basic_steam"\n  name: "Basic Steam Turbine"\n  category: "propulsion"\n  cost: 100\n  year: 1880\n`,
  economies: `- nationId: "uk"\n  treasury: 800\n  income: 150\n  expenses: 75\n- nationId: "france"\n  treasury: 600\n  income: 120\n  expenses: 60\n`,
  fleets: `[]\n`,
  constructions: `[]\n`,
  diplomacy: `- nationA: "uk"\n  nationB: "france"\n  relation: "neutral"\n  since: "1880-01"\n`,
  research: `[]\n`,
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
  };
}

function compile(variant: Variant = {}) {
  fixture = createFixtureDir(
    resolve(tmpdir(), `bw-prestige-${Math.random().toString(36).slice(2)}`),
  );
  const dir = fixture.path;
  const countries = nationsYaml([
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
  writeFixture(dir, "rulesets.yaml", variant.rulesets ?? rulesetsYaml());
  writeFixture(dir, "countries.yaml", countries);
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
    writeFixture(dir, `${name}.yaml`, FILES[name]);
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
    const { collector, output } = compile({ rulesets: rulesetsYaml({ prestige: "omit" }) });
    expect(codes(collector)).toContain(PRESTIGE_COMPILE_CODES.valueSetMissing);
    expect(output).toBeUndefined();
  });

  it("fails with the offending field named when the value set is malformed", () => {
    const bad = { ...FIXTURE_PRESTIGE_VALUE_SET, sackingProbabilityBp: 12_000 };
    const { collector, output } = compile({ rulesets: rulesetsYaml({ prestige: bad }) });
    const diagnostic = collector.all.find((d) => d.code === PRESTIGE_COMPILE_CODES.valueSetInvalid);
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain("sackingProbabilityBp");
    expect(output).toBeUndefined();
  });

  it("rejects an excess key in the value set", () => {
    const bad = { ...FIXTURE_PRESTIGE_VALUE_SET, bonus: 1 };
    const { collector } = compile({ rulesets: rulesetsYaml({ prestige: bad }) });
    const diagnostic = collector.all.find((d) => d.code === PRESTIGE_COMPILE_CODES.valueSetInvalid);
    expect(diagnostic?.message).toContain("bonus");
  });

  it("is ambiguous, not guessed, when two rulesets both carry a value set", () => {
    const two = `${rulesetsYaml()}${rulesetsYaml().replace('id: "core"', 'id: "other"')}`;
    const { collector, output } = compile({ rulesets: two });
    expect(codes(collector)).toContain(PRESTIGE_COMPILE_CODES.valueSetAmbiguous);
    expect(output).toBeUndefined();
  });

  it("validates a nation's start against the bounds the value set declares", () => {
    const wide = { ...FIXTURE_PRESTIGE_VALUE_SET, upperBound: 1_000 };
    const { collector } = compile({
      uk: { prestige: 500 },
      rulesets: rulesetsYaml({ prestige: wide }),
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
