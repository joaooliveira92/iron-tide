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

export function jsonDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function rulesetRecord(options: { prestige?: unknown } = {}): Record<string, unknown> {
  const prestige = "prestige" in options ? options.prestige : FIXTURE_PRESTIGE_VALUE_SET;
  return {
    id: "core",
    name: "Core Rules",
    version: "1.0",
    ...(prestige === "omit" ? {} : { prestige }),
  };
}

export function rulesetsDocument(options: { prestige?: unknown } = {}): string {
  return jsonDocument([rulesetRecord(options)]);
}

export const FIXTURE_RULESETS_JSON = rulesetsDocument();

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

export function nationRecord(spec: NationFixtureSpec): Record<string, unknown> {
  const { id, tag, name, isPlayable = false, homeArea } = spec;
  return {
    id,
    tag,
    name,
    displayNameKey: `nation.${id}`,
    isPlayable,
    ...(homeArea === undefined ? {} : { homeArea }),
    ...(spec.omitPrestige ? {} : { prestige: spec.prestige ?? FIXTURE_NATION_PRESTIGE }),
    slot: null,
    presentation: { colorBg: "#C8102E", colorFg: "#FFFFFF" },
    identity: { oneSentence: "x", fullIdentity: "x", strategicProblem: "x" },
    traits: [],
    regime: {
      type: "monarchy",
      politicalSystem: "constitutional_monarchy",
      governmentType: "limited_democracy",
      headOfState: "x",
      headOfGovernment: "x",
      leaderTitle: "x",
      navalPolicyActors: [],
      governmentModifiers: [],
      stabilityProfile: { level: "high", factors: [] },
      description: "x",
    },
    strategicObjectives: { primary: "x", secondary: "x" },
    baseResources: {
      gdpTier: "great_power",
      gdpDescription: "x",
      population: "x",
      industrialization: "industrial",
      industrializationDescription: "x",
    },
    navalAppropriation: { budgetLevel: "moderate", justification: "x" },
    economy: {
      description: "x",
      character: "x",
      strengths: [],
      weaknesses: [],
      industrialBase: "mature_global",
    },
    navalInstitution: { description: "x", character: [], seniority: "senior_service" },
    doctrine: { summary: "x", schools: [] },
    shipDesign: { summary: "x", principles: [], favoredTypes: [] },
    ai: { archetype: "status_quo_maritime_hegemon", behavior: [] },
    navalPurpose: "sustain_global_empire",
    coreAnxiety: "loss_of_sea_control_overstretch",
    gameplayFeel: "manage_supremacy",
    historicalAssumptions: [],
  };
}

export function nationDocument(spec: NationFixtureSpec): string {
  return jsonDocument([nationRecord(spec)]);
}

export function nationsDocument(specs: NationFixtureSpec[]): string {
  return jsonDocument(specs.map(nationRecord));
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
