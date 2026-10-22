import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { FLEET_SIZE_IDS } from "./fleetSize.js";
import { RESEARCH_IDS } from "./researchSpeed.js";
import { VARIATION_IDS } from "./technologyVariation.js";
export const CANONICAL_SCENARIO_IDS = [
  "scen_1880",
  "scen_1900",
  "scen_1920",
  "scen_1935",
  "scen_1960",
] as const;
export type ScenarioId = (typeof CANONICAL_SCENARIO_IDS)[number];
export interface ScenarioDefinition {
  scenarioId: ScenarioId;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  scenarioContentHash: string;
  participationManifestId: string;
  continuityManifestId: string;
  supportedFleetSizeSettingIds: string[];
  supportedResearchSpeedSettingIds: string[];
  supportedTechnologyVariationSettingIds: string[];
  supportedHistoricalBudgetOptionIds: string[];
  supportedLegacyFleetModeIds: string[];
  supportedTacticalRealismModeIds: string[];
  supportedDifficultyProfileIds: string[];
}
const YEAR_OF: Record<string, number> = {
  scen_1880: 1880,
  scen_1900: 1900,
  scen_1920: 1920,
  scen_1935: 1935,
  scen_1960: 1960,
};
const ALLOWED_FLEET = new Set<string>(FLEET_SIZE_IDS);
const ALLOWED_RESEARCH = new Set<string>(RESEARCH_IDS);
const ALLOWED_VARIATION = new Set<string>(VARIATION_IDS);
export const CANONICAL_SCENARIOS: ScenarioDefinition[] = CANONICAL_SCENARIO_IDS.map((id) => ({
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
}));
const REQUIRED = [
  "scenarioId",
  "startYear",
  "startMonth",
  "endYear",
  "endMonth",
  "scenarioContentHash",
  "participationManifestId",
  "continuityManifestId",
  "supportedFleetSizeSettingIds",
  "supportedResearchSpeedSettingIds",
  "supportedTechnologyVariationSettingIds",
  "supportedHistoricalBudgetOptionIds",
  "supportedLegacyFleetModeIds",
  "supportedTacticalRealismModeIds",
  "supportedDifficultyProfileIds",
] as const;

function isNonEmptyStringArray(v: unknown): boolean {
  return (
    Array.isArray(v) && v.length > 0 && v.every((e) => typeof e === "string" && e.trim() !== "")
  );
}

function hasRequiredScenarioFields(r: Record<string, unknown>, c: DiagnosticCollector): boolean {
  let ok = true;
  for (const f of REQUIRED) {
    if (!(f in r)) {
      c.addError(
        "INVALID_SCENARIO_DEFINITION",
        `Missing field ${f} in scenario ${(r["scenarioId"] as string) ?? "unknown"}`,
        { stage: "scenario-validation" },
      );
      ok = false;
    }
  }
  return ok;
}

function registerScenarioId(
  r: Record<string, unknown>,
  seen: Set<string>,
  c: DiagnosticCollector,
): string | undefined {
  const id = r["scenarioId"] as string;
  if (typeof id !== "string" || !CANONICAL_SCENARIO_IDS.includes(id as ScenarioId)) {
    c.addError("INVALID_SCENARIO_DEFINITION", `Invalid scenarioId ${String(id)}`, {
      stage: "scenario-validation",
    });
    return undefined;
  }
  if (seen.has(id)) {
    c.addError("INVALID_SCENARIO_DEFINITION", `Duplicate scenarioId ${id}`, {
      stage: "scenario-validation",
    });
  }
  seen.add(id);
  return id;
}

function validateScenarioCalendar(
  r: Record<string, unknown>,
  id: string,
  c: DiagnosticCollector,
): boolean {
  let ok = true;
  const exp = YEAR_OF[id]!;
  if (r["startYear"] !== exp || r["startMonth"] !== 1) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Scenario ${id} must start January ${exp}, got ${String(r["startYear"])}-${String(r["startMonth"])}`,
      { stage: "scenario-validation" },
    );
    ok = false;
  }
  if (r["endYear"] !== 1970 || r["endMonth"] !== 12) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Scenario ${id} must end December 1970, got ${String(r["endYear"])}-${String(r["endMonth"])}`,
      { stage: "scenario-validation" },
    );
    ok = false;
  }
  return ok;
}

function validateScenarioSupportedFields(
  r: Record<string, unknown>,
  id: string,
  c: DiagnosticCollector,
): boolean {
  let ok = true;
  const checks: Array<[string, Set<string>]> = [
    ["supportedFleetSizeSettingIds", ALLOWED_FLEET],
    ["supportedResearchSpeedSettingIds", ALLOWED_RESEARCH],
    ["supportedTechnologyVariationSettingIds", ALLOWED_VARIATION],
  ];
  for (const [field, allowed] of checks) {
    const v = r[field];
    if (!isNonEmptyStringArray(v)) {
      c.addError("INVALID_SCENARIO_DEFINITION", `${id}: ${field} must be non-empty string array`, {
        stage: "scenario-validation",
      });
      ok = false;
    } else {
      for (const e of v as string[])
        if (!allowed.has(e)) {
          c.addError("INVALID_SCENARIO_DEFINITION", `${id}: ${field} contains invalid value ${e}`, {
            stage: "scenario-validation",
          });
          ok = false;
        }
    }
  }
  for (const field of [
    "supportedHistoricalBudgetOptionIds",
    "supportedLegacyFleetModeIds",
    "supportedTacticalRealismModeIds",
    "supportedDifficultyProfileIds",
  ]) {
    if (!isNonEmptyStringArray(r[field])) {
      c.addError("INVALID_SCENARIO_DEFINITION", `${id}: ${field} must be non-empty string array`, {
        stage: "scenario-validation",
      });
      ok = false;
    }
  }
  return ok;
}

function validateScenarioRecord(
  r: Record<string, unknown>,
  seen: Set<string>,
  c: DiagnosticCollector,
): boolean {
  let ok = hasRequiredScenarioFields(r, c);
  const id = registerScenarioId(r, seen, c);
  if (id === undefined) return false;
  if (!validateScenarioCalendar(r, id, c)) ok = false;
  if (!validateScenarioSupportedFields(r, id, c)) ok = false;
  return ok;
}

export function validateScenarios(
  input: unknown,
  c: DiagnosticCollector,
): ScenarioDefinition[] | undefined {
  if (!Array.isArray(input)) {
    c.addError("INVALID_SCENARIO_DEFINITION", "Scenarios must be an array", {
      stage: "scenario-validation",
    });
    return undefined;
  }
  if (input.length !== 5) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Canonical pack must define exactly 5 scenarios, got ${input.length}`,
      { stage: "scenario-validation" },
    );
    return undefined;
  }
  let ok = true;
  const seen = new Set<string>();
  for (const s of input) {
    if (typeof s !== "object" || s === null) {
      c.addError("INVALID_SCENARIO_DEFINITION", "scenario must be object", {
        stage: "scenario-validation",
      });
      ok = false;
      continue;
    }
    if (!validateScenarioRecord(s as Record<string, unknown>, seen, c)) ok = false;
  }
  for (const id of CANONICAL_SCENARIO_IDS) {
    if (!seen.has(id)) {
      c.addError("INVALID_SCENARIO_DEFINITION", `Missing canonical scenario ${id}`, {
        stage: "scenario-validation",
      });
      ok = false;
    }
  }
  return ok ? (input as ScenarioDefinition[]) : undefined;
}
export function getScenarioById(id: ScenarioId): ScenarioDefinition | undefined {
  return CANONICAL_SCENARIOS.find((s) => s.scenarioId === id);
}
