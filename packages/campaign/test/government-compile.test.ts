import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  createFixtureDir,
  jsonDocument,
  nationsDocument,
  rulesetsDocument,
  writeFixture,
  type FixtureDir,
} from "@bluewave/test-support";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CampaignCompiler } from "../src/compiler-public.js";

const COLLECTIONS = {
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
    { id: "basic_steam", name: "Basic Steam", category: "propulsion", cost: 100, year: 1880 },
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

let fixture: FixtureDir | undefined;
afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
});

function compile() {
  fixture = createFixtureDir(
    resolve(tmpdir(), `bw-government-${Math.random().toString(36).slice(2)}`),
  );
  const dir = fixture.path;
  writeFixture(
    dir,
    "pack.json",
    JSON.stringify({ name: "government-fixture", version: "0.1.0", type: "fixture", files: {} }),
  );
  writeFixture(dir, "rulesets.json", rulesetsDocument());
  writeFixture(
    dir,
    "countries.json",
    nationsDocument([
      {
        id: "uk",
        tag: "GBR",
        name: "United Kingdom",
        isPlayable: true,
        homeArea: "lon",
        governmentType: "liberal_democracy",
        traits: ["cautious", "global_naval_power"],
      },
      { id: "france", tag: "FRA", name: "France", homeArea: "par", governmentType: "autocratic" },
    ]),
  );
  for (const [name, body] of Object.entries(COLLECTIONS)) writeFixture(dir, `${name}.json`, body);
  const input: CompilerInput = {
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
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const artifact = buildContentBundleArtifact(input, signal, collector);
  const output = artifact
    ? new CampaignCompiler().compile(
        {
          contentBundle: artifact.bundle,
          contentHash: artifact.envelope.bodyHash,
          rulesetVersion: "1.0",
          compatibilityVersion: "5.0.0",
        },
        signal,
        collector,
      )
    : undefined;
  return { collector, output };
}

describe("S-4 slice 1: government type, traits and event history at the compile boundary", () => {
  it("compiles each nation's authored government type and traits into the snapshot", () => {
    const { collector, output } = compile();
    expect(collector.errors).toEqual([]);
    const nations = output?.state.snapshot.nations;
    expect(nations?.get("uk")?.governmentType).toBe("liberal_democracy");
    expect(nations?.get("uk")?.traits).toEqual(["cautious", "global_naval_power"]);
    expect(nations?.get("france")?.governmentType).toBe("autocratic");
    expect(nations?.get("france")?.traits).toEqual([]);
  });

  it("starts every nation with an empty fired-event history and no flags", () => {
    const { output } = compile();
    for (const nation of output?.state.snapshot.nations.values() ?? []) {
      expect(nation.eventHistory).toEqual({ fired: [], flags: [] });
    }
  });
});
