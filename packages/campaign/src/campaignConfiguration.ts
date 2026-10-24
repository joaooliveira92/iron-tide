import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { compareCodePoints } from "@bluewave/deterministic";
import { Result, Schema, type SchemaIssue } from "effect";
import { FLEET_SIZE_IDS } from "./fleetSize.js";
import { issueKeys } from "./schemaIssueKeys.js";
import { RESEARCH_IDS } from "./researchSpeed.js";
import { CANONICAL_SCENARIO_IDS } from "./scenario.js";
import { VARIATION_IDS } from "./technologyVariation.js";

const HEX32 = /^[0-9a-f]{32}$/;
const NON_BLANK = /\S/;

const nonBlankString = Schema.String.check(Schema.isPattern(NON_BLANK));

export const CampaignSeedSchema = Schema.String.check(Schema.isPattern(HEX32));

export const CampaignConfigurationSchema = Schema.Struct({
  scenarioId: Schema.Literals(CANONICAL_SCENARIO_IDS),
  playerSlotId: nonBlankString,
  continuityModeId: Schema.Literals(["historical", "alternate_continuity_v1"]),
  fleetSizeSettingId: Schema.Literals(FLEET_SIZE_IDS),
  researchSpeedSettingId: Schema.Literals(RESEARCH_IDS),
  technologyVariationSettingId: Schema.Literals(VARIATION_IDS),
  historicalBudgetOptionId: nonBlankString,
  legacyFleetModeId: nonBlankString,
  tacticalRealismModeId: nonBlankString,
  difficultyProfileId: nonBlankString,
  campaignSeed: CampaignSeedSchema,
  configurationSchemaVersion: nonBlankString,
  archetype: Schema.optional(Schema.String),
});

export type CampaignConfiguration = typeof CampaignConfigurationSchema.Type;

type MandatoryField = Exclude<keyof CampaignConfiguration, "archetype">;

export const CAMPAIGN_CONFIGURATION_FIELDS: readonly MandatoryField[] = [
  "scenarioId",
  "playerSlotId",
  "continuityModeId",
  "fleetSizeSettingId",
  "researchSpeedSettingId",
  "technologyVariationSettingId",
  "historicalBudgetOptionId",
  "legacyFleetModeId",
  "tacticalRealismModeId",
  "difficultyProfileId",
  "campaignSeed",
  "configurationSchemaVersion",
];

const STAGE = { stage: "campaign-configuration" } as const;

const ENUM_FIELDS: readonly MandatoryField[] = [
  "scenarioId",
  "continuityModeId",
  "fleetSizeSettingId",
  "researchSpeedSettingId",
  "technologyVariationSettingId",
];

const decodeStrict = Schema.decodeUnknownResult(CampaignConfigurationSchema, {
  errors: "all",
  onExcessProperty: "error",
});

const isCampaignSeed = Schema.is(CampaignSeedSchema);

export function validateCampaignSeed(seed: unknown, c: DiagnosticCollector): boolean {
  if (!isCampaignSeed(seed)) {
    c.addError(
      "INVALID_CAMPAIGN_SEED",
      `campaignSeed must be 32 lower hex chars, got ${String(seed)}`,
      STAGE,
    );
    return false;
  }
  return true;
}

function isAbsent(value: unknown): boolean {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

function reportRejection(
  issue: SchemaIssue.Issue,
  input: Readonly<Record<string, unknown>>,
  c: DiagnosticCollector,
): void {
  const keys = issueKeys(issue);
  const fields = new Set([...keys.missing, ...keys.invalid]);
  const { unexpected } = keys;

  let missing = false;
  for (const field of CAMPAIGN_CONFIGURATION_FIELDS) {
    if (isAbsent(input[field])) {
      c.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `Missing mandatory field ${field} (null/omission/empty prohibited)`,
        STAGE,
      );
      missing = true;
    }
  }
  if (missing) return;

  if (fields.has("campaignSeed")) validateCampaignSeed(input["campaignSeed"], c);
  for (const field of ENUM_FIELDS) {
    if (fields.has(field)) {
      c.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `Invalid ${field} ${String(input[field])}`,
        STAGE,
      );
    }
  }
  for (const field of CAMPAIGN_CONFIGURATION_FIELDS) {
    if (fields.has(field) && field !== "campaignSeed" && !ENUM_FIELDS.includes(field)) {
      c.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `Invalid ${field} ${String(input[field])}`,
        STAGE,
      );
    }
  }
  if (fields.has("archetype")) {
    c.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      `Invalid archetype ${String(input["archetype"])}`,
      STAGE,
    );
  }
  for (const key of [...unexpected].sort(compareCodePoints)) {
    c.addError("INVALID_CAMPAIGN_CONFIGURATION", `Unknown field ${key}`, STAGE);
  }
}

export function decodeCampaignConfiguration(
  cfg: unknown,
  c: DiagnosticCollector,
): CampaignConfiguration | undefined {
  if (typeof cfg !== "object" || cfg === null) {
    c.addError("INVALID_CAMPAIGN_CONFIGURATION", "CampaignConfiguration must be object", STAGE);
    return undefined;
  }
  const decoded = decodeStrict(cfg);
  if (Result.isSuccess(decoded)) return decoded.success;
  reportRejection(decoded.failure.issue, Object.fromEntries(Object.entries(cfg)), c);
  return undefined;
}

export function validateCampaignConfiguration(cfg: unknown, c: DiagnosticCollector): boolean {
  return decodeCampaignConfiguration(cfg, c) !== undefined;
}

export function assertConfigurationImmutability(
  prev: CampaignConfiguration,
  next: CampaignConfiguration,
  c: DiagnosticCollector,
): boolean {
  for (const f of CAMPAIGN_CONFIGURATION_FIELDS) {
    if (prev[f] !== next[f]) {
      c.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `Post-save mutation of ${f}: ${String(prev[f])} -> ${String(next[f])} (immutable)`,
        STAGE,
      );
      return false;
    }
  }
  return true;
}
