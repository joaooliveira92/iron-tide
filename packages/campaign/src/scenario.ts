import { compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { FLEET_SIZE_IDS } from "./fleetSize.js";
import { RESEARCH_IDS } from "./researchSpeed.js";
import { issueKeys } from "./schemaIssueKeys.js";
import { VARIATION_IDS } from "./technologyVariation.js";
export const CANONICAL_SCENARIO_IDS = [
  "scen_1880",
  "scen_1900",
  "scen_1920",
  "scen_1935",
  "scen_1960",
] as const;
export type ScenarioId = (typeof CANONICAL_SCENARIO_IDS)[number];
const nonBlankString = Schema.String.check(Schema.isPattern(/\S/));

const ScenarioIdSchema = Schema.Literals(CANONICAL_SCENARIO_IDS);
const FleetSizeIdSchema = Schema.Literals(FLEET_SIZE_IDS);
const ResearchSpeedIdSchema = Schema.Literals(RESEARCH_IDS);
const TechnologyVariationIdSchema = Schema.Literals(VARIATION_IDS);
const NonBlankStringListSchema = Schema.NonEmptyArray(nonBlankString);

export const ScenarioDefinitionSchema = Schema.Struct({
  scenarioId: ScenarioIdSchema,
  startYear: Schema.Int,
  startMonth: Schema.Int,
  endYear: Schema.Int,
  endMonth: Schema.Int,
  scenarioContentHash: Schema.String,
  participationManifestId: Schema.String,
  continuityManifestId: Schema.String,
  supportedFleetSizeSettingIds: Schema.NonEmptyArray(FleetSizeIdSchema),
  supportedResearchSpeedSettingIds: Schema.NonEmptyArray(ResearchSpeedIdSchema),
  supportedTechnologyVariationSettingIds: Schema.NonEmptyArray(TechnologyVariationIdSchema),
  supportedHistoricalBudgetOptionIds: NonBlankStringListSchema,
  supportedLegacyFleetModeIds: NonBlankStringListSchema,
  supportedTacticalRealismModeIds: NonBlankStringListSchema,
  supportedDifficultyProfileIds: NonBlankStringListSchema,
});

export type ScenarioDefinition = typeof ScenarioDefinitionSchema.Type;

const YEAR_OF: Record<string, number> = {
  scen_1880: 1880,
  scen_1900: 1900,
  scen_1920: 1920,
  scen_1935: 1935,
  scen_1960: 1960,
};
export const CANONICAL_SCENARIOS: ScenarioDefinition[] = CANONICAL_SCENARIO_IDS.map(
  (id): ScenarioDefinition => ({
    scenarioId: id,
    startYear: YEAR_OF[id]!,
    startMonth: 1,
    endYear: 1970,
    endMonth: 12,
    scenarioContentHash: "a".repeat(64),
    participationManifestId: `participation_${id}`,
    continuityManifestId: `continuity_${id}`,
    supportedFleetSizeSettingIds: ["small", "standard", "large", "very_large"],
    supportedResearchSpeedSettingIds: ["slow", "standard", "fast", "very_fast"],
    supportedTechnologyVariationSettingIds: ["none", "some", "considerable"],
    supportedHistoricalBudgetOptionIds: ["standard", "historical"],
    supportedLegacyFleetModeIds: ["historical", "generated", "disabled"],
    supportedTacticalRealismModeIds: ["standard", "realistic", "not_applicable"],
    supportedDifficultyProfileIds: ["easy", "normal", "hard", "very_hard"],
  }),
);
const STAGE = { stage: "scenario-validation" } as const;

const REQUIRED = Object.keys(ScenarioDefinitionSchema.fields) as ReadonlyArray<
  keyof ScenarioDefinition
>;

const ENUMERATED_LISTS = [
  ["supportedFleetSizeSettingIds", Schema.is(FleetSizeIdSchema)],
  ["supportedResearchSpeedSettingIds", Schema.is(ResearchSpeedIdSchema)],
  ["supportedTechnologyVariationSettingIds", Schema.is(TechnologyVariationIdSchema)],
] as const;

const FREE_LISTS = [
  "supportedHistoricalBudgetOptionIds",
  "supportedLegacyFleetModeIds",
  "supportedTacticalRealismModeIds",
  "supportedDifficultyProfileIds",
] as const;

const TEXT_FIELDS = [
  "scenarioContentHash",
  "participationManifestId",
  "continuityManifestId",
] as const;

const decodeScenario = Schema.decodeUnknownResult(ScenarioDefinitionSchema, {
  errors: "all",
  onExcessProperty: "error",
});

const isScenarioId = Schema.is(ScenarioIdSchema);
const isNonBlankStringList = Schema.is(NonBlankStringListSchema);

function describeScenarioId(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "unknown";
}

function reportCalendar(
  r: Readonly<Record<string, unknown>>,
  id: ScenarioId,
  c: DiagnosticCollector,
) {
  const exp = YEAR_OF[id]!;
  if (r["startYear"] !== exp || r["startMonth"] !== 1) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Scenario ${id} must start January ${exp}, got ${String(r["startYear"])}-${String(r["startMonth"])}`,
      STAGE,
    );
  }
  if (r["endYear"] !== 1970 || r["endMonth"] !== 12) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Scenario ${id} must end December 1970, got ${String(r["endYear"])}-${String(r["endMonth"])}`,
      STAGE,
    );
  }
}

function reportSupportedLists(
  r: Readonly<Record<string, unknown>>,
  id: ScenarioId,
  rejected: ReadonlySet<string>,
  c: DiagnosticCollector,
) {
  for (const [field, isAllowed] of ENUMERATED_LISTS) {
    if (!rejected.has(field)) continue;
    const value = r[field];
    if (!isNonBlankStringList(value)) {
      c.addError(
        "INVALID_SCENARIO_DEFINITION",
        `${id}: ${field} must be non-empty string array`,
        STAGE,
      );
      continue;
    }
    for (const entry of value) {
      if (!isAllowed(entry)) {
        c.addError(
          "INVALID_SCENARIO_DEFINITION",
          `${id}: ${field} contains invalid value ${entry}`,
          STAGE,
        );
      }
    }
  }
  for (const field of FREE_LISTS) {
    if (rejected.has(field)) {
      c.addError(
        "INVALID_SCENARIO_DEFINITION",
        `${id}: ${field} must be non-empty string array`,
        STAGE,
      );
    }
  }
}

function validateScenarioRecord(
  record: object,
  seen: Set<string>,
  c: DiagnosticCollector,
): ScenarioDefinition | undefined {
  const r: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(record));
  const errorsBefore = c.errors.length;
  const decoded = decodeScenario(r);
  const keys = Result.isSuccess(decoded) ? undefined : issueKeys(decoded.failure.issue);
  let ok = Result.isSuccess(decoded);

  for (const field of REQUIRED) {
    if (keys?.missing.has(field) === true) {
      c.addError(
        "INVALID_SCENARIO_DEFINITION",
        `Missing field ${field} in scenario ${describeScenarioId(r["scenarioId"])}`,
        STAGE,
      );
    }
  }

  const rawId = r["scenarioId"];
  if (!isScenarioId(rawId)) {
    c.addError("INVALID_SCENARIO_DEFINITION", `Invalid scenarioId ${String(rawId)}`, STAGE);
    return undefined;
  }
  if (seen.has(rawId)) {
    c.addError("INVALID_SCENARIO_DEFINITION", `Duplicate scenarioId ${rawId}`, STAGE);
  }
  seen.add(rawId);

  reportCalendar(r, rawId, c);
  if (keys !== undefined) {
    const rejected = new Set([...keys.missing, ...keys.invalid]);
    reportSupportedLists(r, rawId, rejected, c);
    for (const field of TEXT_FIELDS) {
      if (keys.invalid.has(field)) {
        c.addError("INVALID_SCENARIO_DEFINITION", `${rawId}: ${field} must be a string`, STAGE);
      }
    }
    for (const key of [...keys.unexpected].sort(compareCodePoints)) {
      c.addError("INVALID_SCENARIO_DEFINITION", `${rawId}: unknown field ${key}`, STAGE);
    }
  }

  if (!ok || c.errors.length > errorsBefore) {
    if (c.errors.length === errorsBefore) {
      c.addError("INVALID_SCENARIO_DEFINITION", `${rawId}: invalid scenario definition`, STAGE);
    }
    return undefined;
  }
  return Result.isSuccess(decoded) ? decoded.success : undefined;
}

export function validateScenarios(
  input: unknown,
  c: DiagnosticCollector,
): ScenarioDefinition[] | undefined {
  if (!Array.isArray(input)) {
    c.addError("INVALID_SCENARIO_DEFINITION", "Scenarios must be an array", STAGE);
    return undefined;
  }
  if (input.length !== 5) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Canonical pack must define exactly 5 scenarios, got ${input.length}`,
      STAGE,
    );
    return undefined;
  }
  const accepted: ScenarioDefinition[] = [];
  let ok = true;
  const seen = new Set<string>();
  for (const s of input) {
    if (typeof s !== "object" || s === null) {
      c.addError("INVALID_SCENARIO_DEFINITION", "scenario must be object", STAGE);
      ok = false;
      continue;
    }
    const scenario = validateScenarioRecord(s, seen, c);
    if (scenario === undefined) ok = false;
    else accepted.push(scenario);
  }
  for (const id of CANONICAL_SCENARIO_IDS) {
    if (!seen.has(id)) {
      c.addError("INVALID_SCENARIO_DEFINITION", `Missing canonical scenario ${id}`, STAGE);
      ok = false;
    }
  }
  return ok ? accepted : undefined;
}
export function getScenarioById(id: ScenarioId): ScenarioDefinition | undefined {
  return CANONICAL_SCENARIOS.find((s) => s.scenarioId === id);
}
