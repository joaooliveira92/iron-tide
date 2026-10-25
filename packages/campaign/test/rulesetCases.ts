import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  CANONICAL_FLEET_SIZE_SETTINGS,
  validateFleetSizeSetting,
  validateFleetSizeSettings,
} from "../src/fleetSize.js";
import { validateParticipationRecord } from "../src/continuity.js";
import {
  CANONICAL_RESEARCH_SPEED_SETTINGS,
  validateResearchSpeedSettings,
} from "../src/researchSpeed.js";
import {
  CANONICAL_TECH_PROFILES,
  validateTechnologyVariationProfile,
  validateTechnologyVariationProfiles,
} from "../src/technologyVariation.js";

type Row = Record<string, unknown>;

export interface RulesetCase {
  readonly name: string;
  readonly input: unknown;
}

export interface Observed {
  readonly accepted?: boolean;
  readonly returnsInput?: boolean;
  readonly threw?: string;
  readonly diagnostics: readonly { code: string; message: string; stage: string | undefined }[];
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function observe(
  run: (c: DiagnosticCollector) => { accepted: boolean; returnsInput?: boolean },
): Observed {
  const collector = new DiagnosticCollector();
  let outcome: { accepted: boolean; returnsInput?: boolean } | undefined;
  let threw: string | undefined;
  try {
    outcome = run(collector);
  } catch (error) {
    threw = error instanceof Error ? error.constructor.name : "non-error";
  }
  const diagnostics = collector.all.map((d) => ({
    code: d.code,
    message: d.message,
    stage: d.stage,
  }));
  return threw === undefined ? { ...outcome!, diagnostics } : { threw, diagnostics };
}

const NON_OBJECTS: ReadonlyArray<readonly [string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["number", 5],
  ["string", "x"],
  ["boolean", true],
  ["array", []],
];

function toRow(item: object): Row {
  return Object.fromEntries(Object.entries(copy(item)));
}

function without(row: Row, key: string): Row {
  const next = { ...row };
  delete next[key];
  return next;
}

const PARTICIPATION_FIELDS = [
  "scenarioId",
  "playableSlotId",
  "continuityModeId",
  "participationStatus",
  "scenarioNationInstanceId",
  "continuationDefinitionId",
  "reasonCode",
  "contentHash",
] as const;

const PARTICIPATION: Row = {
  scenarioId: "scen_1880",
  playableSlotId: "gbr",
  continuityModeId: "historical",
  participationStatus: "ACTIVE",
  scenarioNationInstanceId: "gbr_1880",
  continuationDefinitionId: "NONE",
  reasonCode: "OPENING",
  contentHash: "abc",
};

export const PARTICIPATION_CASES: readonly RulesetCase[] = [
  { name: "active", input: PARTICIPATION },
  {
    name: "inactive",
    input: { ...PARTICIPATION, participationStatus: "INACTIVE", scenarioNationInstanceId: "NONE" },
  },
  {
    name: "conditional active",
    input: {
      ...PARTICIPATION,
      continuityModeId: "alternate_continuity_v1",
      participationStatus: "CONDITIONAL_ACTIVE",
      continuationDefinitionId: "cont_1",
    },
  },
  {
    name: "active with continuation (not checked here)",
    input: { ...PARTICIPATION, continuationDefinitionId: "cont_1" },
  },
  {
    name: "active without instance",
    input: { ...PARTICIPATION, scenarioNationInstanceId: "NONE" },
  },
  { name: "inactive with instance", input: { ...PARTICIPATION, participationStatus: "INACTIVE" } },
  {
    name: "conditional without continuation",
    input: { ...PARTICIPATION, participationStatus: "CONDITIONAL_ACTIVE" },
  },
  { name: "invalid continuityModeId", input: { ...PARTICIPATION, continuityModeId: "bad" } },
  { name: "invalid participationStatus", input: { ...PARTICIPATION, participationStatus: "bad" } },
  {
    name: "both enums invalid",
    input: { ...PARTICIPATION, continuityModeId: "bad", participationStatus: "bad" },
  },
  {
    name: "invalid enum before later missing field",
    input: { ...without(PARTICIPATION, "contentHash"), continuityModeId: "bad" },
  },
  {
    name: "earlier blank before later missing",
    input: { ...without(PARTICIPATION, "contentHash"), scenarioId: "" },
  },
  { name: "excess key", input: { ...PARTICIPATION, surprise: 1 } },
  ...PARTICIPATION_FIELDS.flatMap((field) => [
    { name: `omitted ${field}`, input: without(PARTICIPATION, field) },
    { name: `null ${field}`, input: { ...PARTICIPATION, [field]: null } },
    { name: `numeric ${field}`, input: { ...PARTICIPATION, [field]: 5 } },
    { name: `empty ${field}`, input: { ...PARTICIPATION, [field]: "" } },
    { name: `blank ${field}`, input: { ...PARTICIPATION, [field]: "  " } },
  ]),
  ...NON_OBJECTS.map(([label, value]) => ({ name: `${label} input`, input: value })),
];

export function observeParticipation(input: unknown): Observed {
  return observe((c) => ({ accepted: validateParticipationRecord(input, c) }));
}

const FLEET_FIELDS = [
  "settingId",
  "navalAppropriationMultiplierBp",
  "sustainableFleetSizeMultiplierBp",
  "aiForceTargetMultiplierBp",
  "generatedLegacyFleetScaleMultiplierBp",
  "roundingMode",
  "rulesetVersion",
] as const;
const FLEET_MULTIPLIERS = FLEET_FIELDS.slice(1, 5);

function fleetRow(): Row {
  return toRow(CANONICAL_FLEET_SIZE_SETTINGS[1]!);
}

const BAD_MULTIPLIERS: ReadonlyArray<readonly [string, unknown]> = [
  ["below", 4999],
  ["above", 20001],
  ["lower edge", 5000],
  ["upper edge", 20000],
  ["fractional", 5000.5],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["string", "10000"],
  ["null", null],
  ["undefined", undefined],
];

export const FLEET_SETTING_CASES: readonly RulesetCase[] = [
  ...CANONICAL_FLEET_SIZE_SETTINGS.map((s) => ({
    name: `canonical ${s.settingId}`,
    input: copy(s),
  })),
  { name: "other ruleset version", input: { ...fleetRow(), rulesetVersion: "2.0" } },
  { name: "unknown settingId (not checked here)", input: { ...fleetRow(), settingId: "huge" } },
  { name: "excess key", input: { ...fleetRow(), surprise: 1 } },
  { name: "rounding CEIL", input: { ...fleetRow(), roundingMode: "CEIL" } },
  {
    name: "rounding missing and multiplier bad",
    input: { ...without(fleetRow(), "roundingMode"), navalAppropriationMultiplierBp: 1 },
  },
  {
    name: "multiplier bad and rounding bad",
    input: { ...fleetRow(), aiForceTargetMultiplierBp: 1, roundingMode: "CEIL" },
  },
  {
    name: "first of several bad multipliers",
    input: { ...fleetRow(), sustainableFleetSizeMultiplierBp: 1, aiForceTargetMultiplierBp: 1 },
  },
  {
    name: "two missing fields",
    input: without(without(fleetRow(), "rulesetVersion"), "roundingMode"),
  },
  ...FLEET_FIELDS.flatMap((field) => [
    { name: `omitted ${field}`, input: without(fleetRow(), field) },
    { name: `null ${field}`, input: { ...fleetRow(), [field]: null } },
  ]),
  ...FLEET_MULTIPLIERS.flatMap((field) =>
    BAD_MULTIPLIERS.map(([label, value]) => ({
      name: `bad ${label} ${field}`,
      input: { ...fleetRow(), [field]: value },
    })),
  ),
  { name: "numeric roundingMode", input: { ...fleetRow(), roundingMode: 1 } },
  { name: "numeric rulesetVersion", input: { ...fleetRow(), rulesetVersion: 1 } },
  { name: "numeric settingId", input: { ...fleetRow(), settingId: 7 } },
  ...NON_OBJECTS.map(([label, value]) => ({ name: `${label} input`, input: value })),
];

export function observeFleetSetting(input: unknown): Observed {
  return observe((c) => ({ accepted: validateFleetSizeSetting(input, c) }));
}

function fleetList(): Row[] {
  return CANONICAL_FLEET_SIZE_SETTINGS.map(toRow);
}

function fleetListWith(index: number, patch: Row): Row[] {
  const list = fleetList();
  list[index] = { ...list[index]!, ...patch };
  return list;
}

export const FLEET_LIST_CASES: readonly RulesetCase[] = [
  { name: "canonical", input: fleetList() },
  { name: "canonical reordered", input: fleetList().reverse() },
  ...NON_OBJECTS.filter(([label]) => label !== "array").map(([label, value]) => ({
    name: `${label} input`,
    input: value,
  })),
  { name: "empty", input: [] },
  { name: "three settings", input: fleetList().slice(0, 3) },
  { name: "five settings", input: [...fleetList(), fleetList()[0]!] },
  { name: "duplicate id with four", input: fleetListWith(3, { settingId: "small" }) },
  { name: "unknown id with four", input: fleetListWith(3, { settingId: "huge" }) },
  {
    name: "canonical value mismatch version 1.0",
    input: fleetListWith(1, { navalAppropriationMultiplierBp: 9000 }),
  },
  {
    name: "canonical value mismatch other version",
    input: fleetListWith(1, { navalAppropriationMultiplierBp: 9000, rulesetVersion: "2.0" }),
  },
  {
    name: "mismatch on each multiplier",
    input: fleetListWith(2, {
      aiForceTargetMultiplierBp: 5000,
      generatedLegacyFleetScaleMultiplierBp: 5000,
    }),
  },
  {
    name: "mismatch on unknown id is ignored",
    input: fleetListWith(3, { settingId: "huge", aiForceTargetMultiplierBp: 5000 }),
  },
  {
    name: "invalid entry and wrong count",
    input: [...fleetListWith(0, { roundingMode: "CEIL" }), fleetList()[0]!],
  },
  { name: "invalid entry among four", input: fleetListWith(0, { roundingMode: "CEIL" }) },
  {
    name: "two invalid entries",
    input: fleetListWith(0, { roundingMode: "CEIL" }).map((r, i) =>
      i === 1 ? { ...r, aiForceTargetMultiplierBp: 1 } : r,
    ),
  },
  {
    name: "missing field entry among four",
    input: fleetList().map((r, i) => (i === 2 ? without(r, "rulesetVersion") : r)),
  },
  { name: "excess key in an entry", input: fleetListWith(0, { surprise: 1 }) },
  { name: "null entry", input: [...fleetList().slice(0, 3), null] },
  { name: "number entry", input: [...fleetList().slice(0, 3), 5] },
];

export function observeFleetList(input: unknown): Observed {
  return observe((c) => {
    const result = validateFleetSizeSettings(input, c);
    return {
      accepted: result !== undefined,
      returnsInput: JSON.stringify(result) === JSON.stringify(input),
    };
  });
}

function researchList(): Row[] {
  return CANONICAL_RESEARCH_SPEED_SETTINGS.map(toRow);
}

function researchListWith(index: number, patch: Row): Row[] {
  const list = researchList();
  list[index] = { ...list[index]!, ...patch };
  return list;
}

export const RESEARCH_CASES: readonly RulesetCase[] = [
  { name: "canonical", input: researchList() },
  { name: "canonical reordered", input: researchList().reverse() },
  ...NON_OBJECTS.filter(([label]) => label !== "array").map(([label, value]) => ({
    name: `${label} input`,
    input: value,
  })),
  { name: "empty", input: [] },
  { name: "three settings", input: researchList().slice(0, 3) },
  { name: "five settings", input: [...researchList(), researchList()[0]!] },
  { name: "duplicate id with four", input: researchListWith(3, { settingId: "slow" }) },
  { name: "unknown id with four", input: researchListWith(3, { settingId: "warp" }) },
  ...BAD_MULTIPLIERS.map(([label, value]) => ({
    name: `${label} multiplierBp`,
    input: researchListWith(0, { multiplierBp: value }),
  })),
  {
    name: "multiplier and id both bad",
    input: researchListWith(0, { multiplierBp: 1, settingId: "warp" }),
  },
  {
    name: "two entries bad",
    input: researchListWith(0, { multiplierBp: 1 }).map((r, i) =>
      i === 2 ? { ...r, settingId: "warp" } : r,
    ),
  },
  { name: "numeric settingId", input: researchListWith(0, { settingId: 7 }) },
  {
    name: "missing settingId",
    input: researchList().map((r, i) => (i === 0 ? without(r, "settingId") : r)),
  },
  {
    name: "missing multiplierBp",
    input: researchList().map((r, i) => (i === 0 ? without(r, "multiplierBp") : r)),
  },
  {
    name: "missing rulesetVersion",
    input: researchList().map((r, i) => (i === 0 ? without(r, "rulesetVersion") : r)),
  },
  { name: "numeric rulesetVersion", input: researchListWith(0, { rulesetVersion: 1 }) },
  { name: "excess key in an entry", input: researchListWith(0, { surprise: 1 }) },
  { name: "null entry", input: [...researchList().slice(0, 3), null] },
  { name: "number entry", input: [...researchList().slice(0, 3), 5] },
  { name: "array entry", input: [...researchList().slice(0, 3), []] },
];

export function observeResearch(input: unknown): Observed {
  return observe((c) => {
    const result = validateResearchSpeedSettings(input, c);
    return {
      accepted: result !== undefined,
      returnsInput: JSON.stringify(result) === JSON.stringify(input),
    };
  });
}

const PROFILE_FIELDS = [
  "settingId",
  "earliestDateShiftMonths",
  "latestDateShiftMonths",
  "effectivenessVariationMinBp",
  "effectivenessVariationMaxBp",
  "dateDistributionId",
  "effectivenessDistributionId",
  "technologyEligibilityPredicateId",
  "variationFormulaVersion",
  "streamFamily",
] as const;

function profile(index: number): Row {
  return toRow(CANONICAL_TECH_PROFILES[index]!);
}

const BAD_SHIFTS: ReadonlyArray<readonly [string, unknown]> = [
  ["fractional", 1.5],
  ["string", "3"],
  ["null", null],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["above 72", 73],
  ["below -72", -73],
];

export const PROFILE_CASES: readonly RulesetCase[] = [
  ...CANONICAL_TECH_PROFILES.map((p) => ({ name: `canonical ${p.settingId}`, input: copy(p) })),
  { name: "excess key", input: { ...profile(1), surprise: 1 } },
  ...PROFILE_FIELDS.flatMap((field) => [
    { name: `omitted ${field}`, input: without(profile(1), field) },
    { name: `null ${field}`, input: { ...profile(1), [field]: null } },
  ]),
  {
    name: "several omitted fields",
    input: without(without(profile(1), "streamFamily"), "settingId"),
  },
  { name: "unknown settingId", input: { ...profile(1), settingId: "extreme" } },
  ...(["earliestDateShiftMonths", "latestDateShiftMonths"] as const).flatMap((field) =>
    BAD_SHIFTS.map(([label, value]) => ({
      name: `bad ${label} ${field}`,
      input: { ...profile(1), [field]: value },
    })),
  ),
  {
    name: "date shift min above max",
    input: { ...profile(1), earliestDateShiftMonths: 10, latestDateShiftMonths: 5 },
  },
  {
    name: "date shift at bounds",
    input: { ...profile(2), earliestDateShiftMonths: -72, latestDateShiftMonths: 72 },
  },
  ...(["effectivenessVariationMinBp", "effectivenessVariationMaxBp"] as const).flatMap((field) => [
    { name: `bad fractional ${field}`, input: { ...profile(1), [field]: 9500.5 } },
    { name: `bad string ${field}`, input: { ...profile(1), [field]: "9500" } },
  ]),
  {
    name: "effectiveness min below 8000",
    input: { ...profile(1), effectivenessVariationMinBp: 7999 },
  },
  {
    name: "effectiveness max above 12000",
    input: { ...profile(1), effectivenessVariationMaxBp: 12001 },
  },
  {
    name: "effectiveness min above max",
    input: {
      ...profile(1),
      effectivenessVariationMinBp: 10500,
      effectivenessVariationMaxBp: 10000,
    },
  },
  {
    name: "effectiveness at bounds",
    input: { ...profile(1), effectivenessVariationMinBp: 8000, effectivenessVariationMaxBp: 12000 },
  },
  { name: "invalid dateDistributionId", input: { ...profile(1), dateDistributionId: "bogus" } },
  {
    name: "invalid effectivenessDistributionId",
    input: { ...profile(1), effectivenessDistributionId: "bogus" },
  },
  {
    name: "both distribution ids invalid",
    input: { ...profile(1), dateDistributionId: "bogus", effectivenessDistributionId: "bogus" },
  },
  { name: "wrong streamFamily", input: { ...profile(1), streamFamily: "other" } },
  { name: "blank predicate id", input: { ...profile(1), technologyEligibilityPredicateId: "  " } },
  { name: "numeric predicate id", input: { ...profile(1), technologyEligibilityPredicateId: 1 } },
  { name: "blank formula version", input: { ...profile(1), variationFormulaVersion: "" } },
  { name: "numeric formula version", input: { ...profile(1), variationFormulaVersion: 1 } },
  {
    name: "none with triangular date distribution",
    input: { ...profile(0), dateDistributionId: "symmetric_triangular_integer_v1" },
  },
  {
    name: "none with triangular effectiveness distribution",
    input: { ...profile(0), effectivenessDistributionId: "symmetric_triangular_integer_v1" },
  },
  {
    name: "some with constant distributions",
    input: {
      ...profile(1),
      dateDistributionId: "constant_zero_v1",
      effectivenessDistributionId: "constant_10000_v1",
    },
  },
  {
    name: "every group broken at once",
    input: {
      ...profile(0),
      settingId: "none",
      earliestDateShiftMonths: 99,
      effectivenessVariationMinBp: 1,
      dateDistributionId: "bogus",
      streamFamily: "other",
      technologyEligibilityPredicateId: "",
    },
  },
  ...NON_OBJECTS.map(([label, value]) => ({ name: `${label} input`, input: value })),
];

export function observeProfile(input: unknown): Observed {
  return observe((c) => ({ accepted: validateTechnologyVariationProfile(input, c) }));
}

function profileList(): Row[] {
  return CANONICAL_TECH_PROFILES.map((_, i) => profile(i));
}

export const PROFILE_LIST_CASES: readonly RulesetCase[] = [
  { name: "canonical", input: profileList() },
  { name: "canonical reordered", input: profileList().reverse() },
  ...NON_OBJECTS.filter(([label]) => label !== "array").map(([label, value]) => ({
    name: `${label} input`,
    input: value,
  })),
  { name: "empty", input: [] },
  { name: "two profiles", input: profileList().slice(0, 2) },
  { name: "four profiles", input: [...profileList(), profile(0)] },
  {
    name: "duplicate id with three",
    input: profileList().map((p, i) => (i === 2 ? { ...p, settingId: "some" } : p)),
  },
  {
    name: "unknown id with three",
    input: profileList().map((p, i) => (i === 2 ? { ...p, settingId: "extreme" } : p)),
  },
  {
    name: "invalid profile among three",
    input: profileList().map((p, i) => (i === 1 ? { ...p, streamFamily: "other" } : p)),
  },
  {
    name: "two invalid profiles",
    input: profileList().map((p, i) => (i > 0 ? { ...p, streamFamily: "other" } : p)),
  },
  { name: "null entry", input: [...profileList().slice(0, 2), null] },
  { name: "number entry", input: [...profileList().slice(0, 2), 5] },
];

export function observeProfileList(input: unknown): Observed {
  return observe((c) => ({ accepted: validateTechnologyVariationProfiles(input, c) }));
}
