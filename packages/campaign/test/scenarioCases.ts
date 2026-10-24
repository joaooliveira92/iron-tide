import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CANONICAL_SCENARIOS, validateScenarios } from "../src/scenario.js";

type Row = Record<string, unknown>;

function canonical(): Row[] {
  return JSON.parse(JSON.stringify(CANONICAL_SCENARIOS)) as Row[];
}

function mutated(index: number, patch: (row: Row) => void): Row[] {
  const rows = canonical();
  patch(rows[index]!);
  return rows;
}

const FIELDS = [
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

const ENUM_ARRAYS = [
  "supportedFleetSizeSettingIds",
  "supportedResearchSpeedSettingIds",
  "supportedTechnologyVariationSettingIds",
] as const;

const FREE_ARRAYS = [
  "supportedHistoricalBudgetOptionIds",
  "supportedLegacyFleetModeIds",
  "supportedTacticalRealismModeIds",
  "supportedDifficultyProfileIds",
] as const;

export interface ScenarioCase {
  readonly name: string;
  readonly input: unknown;
}

export const SCENARIO_CASES: readonly ScenarioCase[] = [
  { name: "canonical", input: canonical() },
  { name: "canonical reordered", input: canonical().reverse() },
  { name: "not an array: null", input: null },
  { name: "not an array: undefined", input: undefined },
  { name: "not an array: object", input: {} },
  { name: "not an array: string", input: "x" },
  { name: "not an array: number", input: 5 },
  { name: "empty array", input: [] },
  { name: "four scenarios", input: canonical().slice(0, 4) },
  { name: "six scenarios", input: [...canonical(), canonical()[0]!] },
  { name: "null entry", input: [...canonical().slice(0, 4), null] },
  { name: "number entry", input: [...canonical().slice(0, 4), 7] },
  { name: "string entry", input: [...canonical().slice(0, 4), "scen_1960"] },
  { name: "array entry", input: [...canonical().slice(0, 4), []] },
  { name: "empty object entry", input: [...canonical().slice(0, 4), {}] },
  ...FIELDS.flatMap((field) => [
    { name: `omitted ${field}`, input: mutated(2, (r) => void delete r[field]) },
    { name: `null ${field}`, input: mutated(2, (r) => void (r[field] = null)) },
  ]),
  {
    name: "omitted scenarioId and calendar",
    input: mutated(1, (r) => {
      delete r["scenarioId"];
      delete r["startYear"];
    }),
  },
  { name: "unknown scenarioId", input: mutated(2, (r) => void (r["scenarioId"] = "scen_9999")) },
  { name: "numeric scenarioId", input: mutated(2, (r) => void (r["scenarioId"] = 1920)) },
  { name: "duplicate scenarioId", input: mutated(2, (r) => void (r["scenarioId"] = "scen_1880")) },
  {
    name: "unknown scenarioId skips later checks",
    input: mutated(2, (r) => {
      r["scenarioId"] = "scen_9999";
      r["startYear"] = 1;
      r["supportedFleetSizeSettingIds"] = [];
    }),
  },
  { name: "wrong startYear", input: mutated(2, (r) => void (r["startYear"] = 1921)) },
  { name: "wrong startMonth", input: mutated(2, (r) => void (r["startMonth"] = 2)) },
  { name: "wrong endYear", input: mutated(2, (r) => void (r["endYear"] = 1969)) },
  { name: "wrong endMonth", input: mutated(2, (r) => void (r["endMonth"] = 11)) },
  {
    name: "wrong start and end",
    input: mutated(2, (r) => {
      r["startYear"] = 1;
      r["endMonth"] = 1;
    }),
  },
  { name: "string startYear", input: mutated(2, (r) => void (r["startYear"] = "1920")) },
  { name: "fractional startYear", input: mutated(2, (r) => void (r["startYear"] = 1920.5)) },
  ...[...ENUM_ARRAYS, ...FREE_ARRAYS].flatMap((field) => [
    { name: `empty ${field}`, input: mutated(3, (r) => void (r[field] = [])) },
    { name: `string ${field}`, input: mutated(3, (r) => void (r[field] = "standard")) },
    {
      name: `numeric element in ${field}`,
      input: mutated(3, (r) => void (r[field] = ["standard", 1])),
    },
    {
      name: `blank element in ${field}`,
      input: mutated(3, (r) => void (r[field] = ["standard", "  "])),
    },
    {
      name: `duplicate elements in ${field}`,
      input: mutated(3, (r) => void (r[field] = ["standard", "standard"])),
    },
  ]),
  ...ENUM_ARRAYS.map((field) => ({
    name: `unknown value in ${field}`,
    input: mutated(3, (r) => void (r[field] = ["standard", "bogus"])),
  })),
  {
    name: "several unknown values in one array",
    input: mutated(3, (r) => void (r["supportedFleetSizeSettingIds"] = ["x", "small", "y"])),
  },
  {
    name: "every supported array broken",
    input: mutated(3, (r) => {
      for (const field of [...ENUM_ARRAYS, ...FREE_ARRAYS]) r[field] = [];
    }),
  },
  {
    name: "calendar and supported both broken",
    input: mutated(3, (r) => {
      r["startMonth"] = 3;
      r["supportedLegacyFleetModeIds"] = [];
    }),
  },
  {
    name: "free arrays accept any strings",
    input: mutated(3, (r) => void (r["supportedDifficultyProfileIds"] = ["anything", "else"])),
  },
  {
    name: "numeric scenarioContentHash",
    input: mutated(2, (r) => void (r["scenarioContentHash"] = 5)),
  },
  {
    name: "empty scenarioContentHash",
    input: mutated(2, (r) => void (r["scenarioContentHash"] = "")),
  },
  {
    name: "numeric participationManifestId",
    input: mutated(2, (r) => void (r["participationManifestId"] = 5)),
  },
  {
    name: "numeric continuityManifestId",
    input: mutated(2, (r) => void (r["continuityManifestId"] = 5)),
  },
  { name: "excess key", input: mutated(2, (r) => void (r["surprise"] = 1)) },
  {
    name: "excess key with invalid scenarioId",
    input: mutated(2, (r) => {
      r["surprise"] = 1;
      r["scenarioId"] = "scen_9999";
    }),
  },
];

export interface ObservedScenarios {
  readonly accepted: boolean;
  readonly returnsInputValues: boolean | undefined;
  readonly diagnostics: readonly { code: string; message: string; stage: string | undefined }[];
}

export function observeScenarios(input: unknown): ObservedScenarios {
  const collector = new DiagnosticCollector();
  const result = validateScenarios(input, collector);
  return {
    accepted: result !== undefined,
    returnsInputValues:
      result === undefined ? undefined : JSON.stringify(result) === JSON.stringify(input),
    diagnostics: collector.all.map((d) => ({ code: d.code, message: d.message, stage: d.stage })),
  };
}
