import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildContentBundleArtifact,
  loadContentModule,
  type CompilerInput,
} from "@bluewave/content-compiler";
import type {
  BattleOfferRules,
  CompiledContentBundle,
  FleetManagementRules,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Data, Effect, Exit, Result } from "effect";

export interface FixtureDir {
  path: string;
  cleanup: () => void;
}

export interface NationFixtureSpec {
  id: string;
  tag: string;
  name: string;
  isPlayable?: boolean;
  homeArea?: string;
  prestige?: unknown;
  omitPrestige?: boolean;
}

export const FIXTURE_NATION_PRESTIGE = 20;

export const FIXTURE_PRESTIGE_VALUE_SET = {
  lowerBound: 0,
  upperBound: 100,
  sackingThreshold: 10,
  sackingProbabilityBp: 2_500,
  rules: {
    UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: 300 },
    BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 500 },
    BATTLE_WON: { kind: "FIXED_GAIN", amount: 1 },
  },
} as const;

export const FIXTURE_PRESTIGE_RULES = {
  lowerBound: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.lowerBound),
  upperBound: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.upperBound),
  sackingThreshold: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.sackingThreshold),
  sackingProbabilityBp: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.sackingProbabilityBp),
  rules: {
    UNPAID_FUNDS: {
      kind: "PROPORTIONAL_LOSS" as const,
      basisPoints: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.rules.UNPAID_FUNDS.basisPoints),
    },
    BATTLE_LOST: {
      kind: "PROPORTIONAL_LOSS" as const,
      basisPoints: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.rules.BATTLE_LOST.basisPoints),
    },
    BATTLE_WON: {
      kind: "FIXED_GAIN" as const,
      amount: SafeInt(FIXTURE_PRESTIGE_VALUE_SET.rules.BATTLE_WON.amount),
    },
  },
};

export function rulesetsYaml(options: { prestige?: unknown } = {}): string {
  const prestige = "prestige" in options ? options.prestige : FIXTURE_PRESTIGE_VALUE_SET;
  const block = prestige === "omit" ? "" : `\n  prestige: ${JSON.stringify(prestige)}`;
  return `- id: "core"\n  name: "Core Rules"\n  version: "1.0"${block}\n`;
}

export const FIXTURE_RULESETS_YAML = rulesetsYaml();

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

export function nationYaml(spec: NationFixtureSpec): string {
  const { id, tag, name, isPlayable = false, homeArea } = spec;
  const prestigeLine = spec.omitPrestige
    ? ""
    : `\n  prestige: ${JSON.stringify(spec.prestige ?? FIXTURE_NATION_PRESTIGE)}`;
  return `
- id: "${id}"
  tag: "${tag}"
  name: "${name}"
  displayNameKey: "nation.${id}"
  isPlayable: ${isPlayable}${homeArea === undefined ? "" : `\n  homeArea: "${homeArea}"`}${prestigeLine}
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
  { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
  { id: "france", tag: "FRA", name: "France", homeArea: "par" },
  { id: "germany", tag: "GER", name: "Germany", homeArea: "ber" },
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

export const VALID_RULESETS_YAML = `\n${FIXTURE_RULESETS_YAML}`;

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

export function buildFixtureContentBundle(
  input: CompilerInput,
  signal: AbortSignal,
  collector: DiagnosticCollector,
): { bundle: CompiledContentBundle; contentHash: string } {
  const artifact = buildContentBundleArtifact(input, signal, collector);
  if (!artifact) {
    throw new Error(
      `fixture content bundle build failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return { bundle: artifact.bundle, contentHash: artifact.envelope.bodyHash };
}

export const FIXTURE_BATTLE_OFFER_RULES: BattleOfferRules = {
  sectionVersion: 1,
  estimateModel: {
    kind: "PERTURBED",
    errorBoundBp: 1_500,
    rounding: "HALF_UP",
    showComposition: false,
  },
  declineVictoryPoints: {
    pointsByMission: { FLEET_BATTLE: 4, CRUISER_BATTLE: 2 },
    distanceModifier: { kind: "NONE" },
    rounding: "FLOOR",
    opponentCredit: { kind: "NONE" },
  },
  declineCounter: { threshold: 2, scope: "WAR", reset: { kind: "ON_WAR_END" } },
  enemyDecline: { comparison: "LESS_THAN", thresholdBp: 4_000, probabilityBp: 6_000 },
  supportForce: { presenceChanceBp: 2_500, shareOfCapBp: 5_000, source: "ALLIED_ONLY" },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "Fixture-class value for tests only.",
  },
};

const fixtureTrainingSubject = (maintenanceAdderBp: number) => ({
  maintenanceAdderBp,
  effectBp: 1_000,
});

export const FIXTURE_FLEET_MANAGEMENT_RULES: FleetManagementRules = {
  sectionVersion: 1,
  divisionCohesion: { monthlyGrowth: 2, cap: 90 },
  divisionExperience: { perBattle: 3, perExercise: 5 },
  reorganisationPenalty: {
    roleChange: { cohesion: 10, experience: 0 },
    formationChange: { cohesion: 5, experience: 0 },
  },
  training: {
    proficiencyMonths: 12,
    maxSubjects: 2,
    subjects: {
      GUNNERY: fixtureTrainingSubject(3_000),
      NIGHT_FIGHTING: fixtureTrainingSubject(2_000),
      TORPEDO_TACTICS: fixtureTrainingSubject(2_000),
      DAMAGE_CONTROL: fixtureTrainingSubject(2_000),
    },
  },
  exercise: { maintenanceMultiple: 2, maxPerCalendarYear: 1 },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "Fixture-class value for tests only.",
  },
};

export function fixtureBattleOfferRules(
  estimateModel: BattleOfferRules["estimateModel"],
): BattleOfferRules {
  return { ...FIXTURE_BATTLE_OFFER_RULES, estimateModel };
}

export function runSync<A, E>(effect: Effect.Effect<A, E>): A {
  return Effect.runSync(effect);
}

export function failureTag<A, E extends { readonly _tag: string }>(
  effect: Effect.Effect<A, E>,
): E["_tag"] | "success" | "defect" {
  const exit = Effect.runSyncExit(effect);
  if (Exit.isSuccess(exit)) return "success";
  const found = Exit.findError(exit);
  return Result.isSuccess(found) ? found.success._tag : "defect";
}

export class AuthoredContentReadError extends Data.TaggedError("AuthoredContentReadError")<{
  readonly path: string;
  readonly message: string;
}> {}

export function readAuthoredFile(absolutePath: string): unknown {
  const loaded = loadContentModule(absolutePath);
  if (!loaded.ok) {
    throw new AuthoredContentReadError({ path: absolutePath, message: loaded.message });
  }
  return structuredClone(loaded.document);
}

export function readAuthoredDocument(root: string, file: string): unknown {
  const loaded = loadContentModule(resolve(root, file));
  if (!loaded.ok) throw new AuthoredContentReadError({ path: file, message: loaded.message });
  return structuredClone(loaded.document);
}
