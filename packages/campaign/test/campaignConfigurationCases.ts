import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  assertConfigurationImmutability,
  CAMPAIGN_CONFIGURATION_FIELDS,
  validateCampaignConfiguration,
} from "../src/campaignConfiguration.js";
import { hashConfiguration } from "../src/campaignSession.js";

const SEED = "a".repeat(32);

export const BASE: Record<string, unknown> = {
  scenarioId: "scen_1880",
  playerSlotId: "gbr",
  continuityModeId: "historical",
  fleetSizeSettingId: "standard",
  researchSpeedSettingId: "standard",
  technologyVariationSettingId: "none",
  historicalBudgetOptionId: "standard",
  legacyFleetModeId: "historical",
  tacticalRealismModeId: "standard",
  difficultyProfileId: "normal",
  campaignSeed: SEED,
  configurationSchemaVersion: "1.0",
};

const DESKTOP: Record<string, unknown> = {
  ...BASE,
  playerSlotId: "uk",
  difficultyProfileId: "easy",
  configurationSchemaVersion: "campaign_configuration_v1",
};

const ENUMS: Record<string, readonly string[]> = {
  scenarioId: ["scen_1880", "scen_1900", "scen_1920", "scen_1935", "scen_1960"],
  continuityModeId: ["historical", "alternate_continuity_v1"],
  fleetSizeSettingId: ["small", "standard", "large", "very_large"],
  researchSpeedSettingId: ["slow", "standard", "fast", "very_fast"],
  technologyVariationSettingId: ["none", "some", "considerable"],
};

export interface ValidateCase {
  readonly name: string;
  readonly input: unknown;
}

function without(key: string): Record<string, unknown> {
  const copy = { ...BASE };
  delete copy[key];
  return copy;
}

export const VALIDATE_CASES: readonly ValidateCase[] = [
  { name: "valid base", input: BASE },
  { name: "valid desktop configuration", input: DESKTOP },
  { name: "valid with archetype token", input: { ...DESKTOP, archetype: "grand_admiral:3:1:1" } },
  { name: "valid with empty archetype", input: { ...BASE, archetype: "" } },
  ...Object.entries(ENUMS).flatMap(([field, values]) =>
    values.map((value) => ({
      name: `valid ${field}=${value}`,
      input: { ...BASE, [field]: value },
    })),
  ),
  ...CAMPAIGN_CONFIGURATION_FIELDS.flatMap((field) => [
    { name: `omitted ${field}`, input: without(field) },
    { name: `null ${field}`, input: { ...BASE, [field]: null } },
    { name: `undefined ${field}`, input: { ...BASE, [field]: undefined } },
    { name: `empty ${field}`, input: { ...BASE, [field]: "" } },
    { name: `blank ${field}`, input: { ...BASE, [field]: "   " } },
  ]),
  { name: "two omitted fields", input: { ...without("scenarioId"), fleetSizeSettingId: null } },
  { name: "all fields omitted", input: {} },
  ...Object.keys(ENUMS).map((field) => ({
    name: `unknown ${field}`,
    input: { ...BASE, [field]: "bogus" },
  })),
  {
    name: "all enums unknown together",
    input: {
      ...BASE,
      scenarioId: "x",
      continuityModeId: "x",
      fleetSizeSettingId: "x",
      researchSpeedSettingId: "x",
      technologyVariationSettingId: "x",
    },
  },
  ...[
    "A".repeat(32),
    "a".repeat(31),
    "a".repeat(33),
    "g".repeat(32),
    "bad",
    " " + "a".repeat(31),
  ].map((seed) => ({
    name: `seed ${JSON.stringify(seed)}`,
    input: { ...BASE, campaignSeed: seed },
  })),
  { name: "bad seed and unknown enum", input: { ...BASE, campaignSeed: "bad", scenarioId: "x" } },
  {
    name: "missing field short-circuits enum checks",
    input: { ...without("playerSlotId"), scenarioId: "x" },
  },
  { name: "null input", input: null },
  { name: "undefined input", input: undefined },
  { name: "number input", input: 5 },
  { name: "string input", input: "x" },
  { name: "boolean input", input: true },
  { name: "array input", input: [] },
  { name: "excess key", input: { ...BASE, surprise: 1 } },
  { name: "number for playerSlotId", input: { ...BASE, playerSlotId: 5 } },
  { name: "number for campaignSeed", input: { ...BASE, campaignSeed: 5 } },
  { name: "number for scenarioId", input: { ...BASE, scenarioId: 5 } },
  { name: "number for archetype", input: { ...BASE, archetype: 5 } },
];

export interface Observed {
  readonly accepted: boolean;
  readonly diagnostics: readonly { code: string; message: string; stage: string | undefined }[];
}

export function observeValidate(input: unknown): Observed {
  const collector = new DiagnosticCollector();
  const accepted = validateCampaignConfiguration(input, collector);
  return {
    accepted,
    diagnostics: collector.all.map((d) => ({ code: d.code, message: d.message, stage: d.stage })),
  };
}

export const IMMUTABILITY_CASES: readonly ValidateCase[] = [
  { name: "unchanged", input: BASE },
  ...CAMPAIGN_CONFIGURATION_FIELDS.map((field) => ({
    name: `changed ${field}`,
    input: { ...BASE, [field]: `${String(BASE[field])}-changed` },
  })),
  { name: "archetype added", input: { ...BASE, archetype: "x" } },
];

export function observeImmutability(next: unknown): Observed {
  const collector = new DiagnosticCollector();
  const accepted = assertConfigurationImmutability(BASE as never, next as never, collector);
  return {
    accepted,
    diagnostics: collector.all.map((d) => ({ code: d.code, message: d.message, stage: d.stage })),
  };
}

export const HASH_CASES: readonly ValidateCase[] = [
  { name: "base", input: BASE },
  { name: "desktop", input: DESKTOP },
  { name: "desktop with archetype", input: { ...DESKTOP, archetype: "grand_admiral:3:1:1" } },
];

export function observeHash(input: unknown): string {
  return hashConfiguration(input as never);
}
