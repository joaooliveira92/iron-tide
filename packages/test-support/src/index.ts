import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildContentBundleArtifact,
  type CompilerInput,
  type ContentBundle,
} from "@bluewave/content-compiler";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export interface FixtureDir {
  path: string;
  cleanup: () => void;
}

export interface NationFixtureSpec {
  id: string;
  tag: string;
  name: string;
  isPlayable?: boolean;
}

export function createFixtureDir(basePath: string): FixtureDir {
  mkdirSync(basePath, { recursive: true });
  return {
    path: basePath,
    cleanup: () => {
      rmSync(basePath, { recursive: true, force: true });
    },
  };
}

export function writeFixture(basePath: string, relativePath: string, content: string): string {
  const fullPath = resolve(basePath, relativePath);
  mkdirSync(resolve(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

/** A single valid, strict-NationSchema-compliant nation as a YAML list item. */
export function nationYaml(spec: NationFixtureSpec): string {
  const { id, tag, name, isPlayable = false } = spec;
  return `
- id: "${id}"
  tag: "${tag}"
  name: "${name}"
  displayNameKey: "nation.${id}"
  isPlayable: ${isPlayable}
  slot: null
  presentation: { colorBg: "#C8102E", colorFg: "#FFFFFF" }
  identity:
    oneSentence: "x"
    fullIdentity: "x"
    strategicProblem: "x"
  regime:
    type: "monarchy"
    politicalSystem: "constitutional_monarchy"
    headOfState: "x"
    headOfGovernment: "x"
    leaderTitle: "x"
    navalPolicyActors: []
    governmentModifiers: []
    stabilityProfile: { level: "high", factors: [] }
    description: "x"
  strategicObjectives: { primary: "x", secondary: "x" }
  baseResources:
    gdpTier: "great_power"
    gdpDescription: "x"
    population: "x"
    industrialization: "industrial"
    industrializationDescription: "x"
  navalAppropriation: { budgetLevel: "moderate", justification: "x" }
  economy:
    description: "x"
    character: "x"
    strengths: []
    weaknesses: []
    industrialBase: "mature_global"
  navalInstitution:
    description: "x"
    character: []
    seniority: "senior_service"
  doctrine: { summary: "x", schools: [] }
  shipDesign: { summary: "x", principles: [], favoredTypes: [] }
  ai: { archetype: "status_quo_maritime_hegemon", behavior: [] }
  navalPurpose: "sustain_global_empire"
  coreAnxiety: "loss_of_sea_control_overstretch"
  gameplayFeel: "manage_supremacy"
  historicalAssumptions: []
`;
}

export function nationsYaml(specs: NationFixtureSpec[]): string {
  return specs.map(nationYaml).join("");
}

export const VALID_FIXTURE_MANIFEST = JSON.stringify({
  name: "test-pack",
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
});

export const VALID_NATIONS_YAML = nationsYaml([
  { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true },
  { id: "france", tag: "FRA", name: "France" },
  { id: "germany", tag: "GER", name: "Germany" },
]);

export const VALID_AREAS_YAML = `
- id: "lon"
  name: "London"
  type: "land"
  controller: "uk"
- id: "par"
  name: "Paris"
  type: "land"
  controller: "france"
- id: "ber"
  name: "Berlin"
  type: "land"
  controller: "germany"
- id: "eng_ch"
  name: "English Channel"
  type: "sea"
- id: "north_sea"
  name: "North Sea"
  type: "sea"
`;

export const VALID_ROUTES_YAML = `
- id: "lon-par"
  from: "lon"
  to: "par"
  type: "sea"
  distance: 300
- id: "lon-ber"
  from: "lon"
  to: "ber"
  type: "sea"
  distance: 600
- id: "par-ber"
  from: "par"
  to: "ber"
  type: "land"
  distance: 800
`;

export const VALID_RULESETS_YAML = `
- id: "core"
  name: "Core Rules"
  version: "1.0"
`;

export const VALID_POSSESSIONS_YAML = `
- id: "uk-lon"
  nationId: "uk"
  areaId: "lon"
- id: "fra-par"
  nationId: "france"
  areaId: "par"
- id: "ger-ber"
  nationId: "germany"
  areaId: "ber"
`;

export const VALID_PORTS_YAML = `
- id: "port-lon"
  name: "Port of London"
  areaId: "lon"
  nationId: "uk"
  level: 5
- id: "port-par"
  name: "Port of Paris"
  areaId: "par"
  nationId: "france"
  level: 3
`;

export const VALID_TECHNOLOGIES_YAML = `
- id: "basic_steam"
  name: "Basic Steam Turbine"
  category: "propulsion"
  cost: 100
  year: 1880
- id: "advanced_steam"
  name: "Advanced Steam Turbine"
  category: "propulsion"
  prerequisites:
    - { techId: "basic_steam" }
  cost: 200
  year: 1900
`;

export const INVALID_FIXTURES = {
  parseError: {
    name: "parse-error",
    manifest: JSON.stringify({
      name: "test-pack",
      version: "0.1.0",
      type: "fixture",
      files: { countries: ["bad.yaml"] },
    }),
    files: { "bad.yaml": "{ invalid yaml: " },
  },
  unknownField: {
    name: "unknown-field",
    manifest: JSON.stringify({
      name: "test-pack",
      version: "0.1.0",
      type: "fixture",
      files: { countries: ["countries.yaml"] },
    }),
    files: {
      "countries.yaml": `${nationYaml({
        id: "uk",
        tag: "GBR",
        name: "United Kingdom",
      })}  unknownField: "something"\n`,
    },
  },
  duplicateId: {
    name: "duplicate-id",
    manifest: JSON.stringify({
      name: "test-pack",
      version: "0.1.0",
      type: "fixture",
      files: { countries: ["countries.yaml"] },
    }),
    files: {
      "countries.yaml": nationsYaml([
        { id: "uk", tag: "GBR", name: "United Kingdom" },
        { id: "uk", tag: "GBR", name: "United Kingdom" },
      ]),
    },
  },
  missingReference: {
    name: "missing-ref",
    manifest: JSON.stringify({
      name: "test-pack",
      version: "0.1.0",
      type: "fixture",
      files: {
        possessions: ["possessions.yaml"],
        countries: ["countries.yaml"],
        areas: ["areas.yaml"],
      },
    }),
    files: {
      "countries.yaml": nationYaml({ id: "uk", tag: "GBR", name: "United Kingdom" }),
      "areas.yaml": '- id: "lon"\n  name: "London"\n  type: "land"\n',
      "possessions.yaml": '- id: "uk-lon"\n  nationId: "uk"\n  areaId: "nonexistent"\n',
    },
  },
  excessiveSize: {
    name: "excessive-size",
    manifest: JSON.stringify({
      name: "test-pack",
      version: "0.1.0",
      type: "fixture",
      files: { countries: ["big.yaml"] },
    }),
    files: {
      "big.yaml": nationsYaml([{ id: "big", tag: "BIG", name: "x".repeat(12 * 1024 * 1024) }]),
    },
  },
};

export function createValidFixture(basePath: string): FixtureDir {
  const fixture = createFixtureDir(basePath);
  writeFixture(fixture.path, "pack.json", VALID_FIXTURE_MANIFEST);
  writeFixture(fixture.path, "rulesets.yaml", VALID_RULESETS_YAML);
  writeFixture(fixture.path, "countries.yaml", VALID_NATIONS_YAML);
  writeFixture(fixture.path, "areas.yaml", VALID_AREAS_YAML);
  writeFixture(fixture.path, "routes.yaml", VALID_ROUTES_YAML);
  writeFixture(fixture.path, "possessions.yaml", VALID_POSSESSIONS_YAML);
  writeFixture(fixture.path, "ports.yaml", VALID_PORTS_YAML);
  writeFixture(fixture.path, "technologies.yaml", VALID_TECHNOLOGIES_YAML);
  return fixture;
}

export function createInvalidFixture(basePath: string, name: string): FixtureDir | undefined {
  const entry = Object.values(INVALID_FIXTURES).find((f) => f.name === name);
  if (!entry) return undefined;

  const fixture = createFixtureDir(resolve(basePath, name));
  writeFixture(fixture.path, "pack.json", entry.manifest);
  for (const [file, content] of Object.entries(entry.files)) {
    writeFixture(fixture.path, file, content);
  }
  return fixture;
}

/**
 * Builds a verified `ContentBundle` from an explicit full-surface `CompilerInput`
 * — the producer path `CampaignCompiler` consumes (CAH-LEG-1). Tests that drive
 * the campaign compiler over a fixture call this first; `CampaignCompiler` has no
 * raw-input branch, so the bundle is the only way in.
 */
export function buildFixtureContentBundle(
  input: CompilerInput,
  signal: AbortSignal,
  collector: DiagnosticCollector,
): { bundle: ContentBundle; contentHash: string } {
  const artifact = buildContentBundleArtifact(input, signal, collector);
  if (!artifact) {
    throw new Error(
      `fixture content bundle build failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return { bundle: artifact.bundle, contentHash: artifact.envelope.bodyHash };
}
