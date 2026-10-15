// packages/campaign/src/campaignConfiguration.ts - DESIGN-03 §3 + §8
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { FLEET_SIZE_IDS } from "./fleetSize.js";
import { RESEARCH_IDS } from "./researchSpeed.js";
import { CANONICAL_SCENARIO_IDS } from "./scenario.js";
import { VARIATION_IDS } from "./technologyVariation.js";

export const CAMPAIGN_CONFIGURATION_FIELDS = [
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
] as const;

export type CampaignConfiguration = {
  scenarioId: (typeof CANONICAL_SCENARIO_IDS)[number];
  playerSlotId: string;
  continuityModeId: "historical" | "alternate_continuity_v1";
  fleetSizeSettingId: (typeof FLEET_SIZE_IDS)[number];
  researchSpeedSettingId: (typeof RESEARCH_IDS)[number];
  technologyVariationSettingId: "none" | "some" | "considerable";
  historicalBudgetOptionId: string;
  legacyFleetModeId: string;
  tacticalRealismModeId: string;
  difficultyProfileId: string;
  campaignSeed: string; // 32 lower hex = u128
  configurationSchemaVersion: string;
};

const HEX32 = /^[0-9a-f]{32}$/;

export function validateCampaignSeed(seed: unknown, c: DiagnosticCollector): boolean {
  if (typeof seed !== "string" || !HEX32.test(seed)) {
    c.addError(
      "INVALID_CAMPAIGN_SEED",
      `campaignSeed must be 32 lower hex chars, got ${String(seed)}`,
      { stage: "campaign-configuration" },
    );
    return false;
  }
  return true;
}

export function validateCampaignConfiguration(cfg: unknown, c: DiagnosticCollector): boolean {
  const r = cfg as Record<string, unknown>;
  if (typeof r !== "object" || r === null) {
    c.addError("INVALID_CAMPAIGN_CONFIGURATION", "CampaignConfiguration must be object", {
      stage: "campaign-configuration",
    });
    return false;
  }
  let ok = true;
  for (const f of CAMPAIGN_CONFIGURATION_FIELDS) {
    if (
      !(f in r) ||
      r[f] === null ||
      r[f] === undefined ||
      (typeof r[f] === "string" && (r[f] as string).trim() === "")
    ) {
      c.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `Missing mandatory field ${f} (null/omission/empty prohibited)`,
        { stage: "campaign-configuration" },
      );
      ok = false;
    }
  }
  if (!ok) return false;
  // seed is separate code per spec
  if (!validateCampaignSeed(r["campaignSeed"], c)) ok = false;

  if (!CANONICAL_SCENARIO_IDS.includes(r["scenarioId"] as any)) {
    c.addError("INVALID_CAMPAIGN_CONFIGURATION", `Invalid scenarioId ${String(r["scenarioId"])}`, {
      stage: "campaign-configuration",
    });
    ok = false;
  }
  if (!["historical", "alternate_continuity_v1"].includes(r["continuityModeId"] as string)) {
    c.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      `Invalid continuityModeId ${String(r["continuityModeId"])}`,
      { stage: "campaign-configuration" },
    );
    ok = false;
  }
  if (!FLEET_SIZE_IDS.includes(r["fleetSizeSettingId"] as any)) {
    c.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      `Invalid fleetSizeSettingId ${String(r["fleetSizeSettingId"])}`,
      { stage: "campaign-configuration" },
    );
    ok = false;
  }
  if (!RESEARCH_IDS.includes(r["researchSpeedSettingId"] as any)) {
    c.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      `Invalid researchSpeedSettingId ${String(r["researchSpeedSettingId"])}`,
      { stage: "campaign-configuration" },
    );
    ok = false;
  }
  if (!VARIATION_IDS.includes(r["technologyVariationSettingId"] as any)) {
    c.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      `Invalid technologyVariationSettingId ${String(r["technologyVariationSettingId"])}`,
      { stage: "campaign-configuration" },
    );
    ok = false;
  }
  // historicalBudgetOptionId etc must be explicit disabled/not_applicable when not supported - we enforce non-empty already; no inferred defaults
  return ok;
}

export function assertConfigurationImmutability(
  prev: CampaignConfiguration,
  next: CampaignConfiguration,
  c: DiagnosticCollector,
): boolean {
  for (const f of CAMPAIGN_CONFIGURATION_FIELDS) {
    if ((prev as any)[f] !== (next as any)[f]) {
      c.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `Post-save mutation of ${f}: ${String((prev as any)[f])} -> ${String((next as any)[f])} (immutable)`,
        { stage: "campaign-configuration" },
      );
      return false;
    }
  }
  return true;
}
