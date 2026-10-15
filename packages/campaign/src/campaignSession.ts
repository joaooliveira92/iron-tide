// DESIGN-03 §2, §3, §8 - campaign session state + preconditions (Normative)
// Validates before RNG, enforces Scenario §1, Timeline §2, Configuration §3, Immutability §8.
// Kept separate from state.ts (compiled world snapshot) - a session tracks configuration +
// the strategic timeline for a single campaign run.

import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  assertConfigurationImmutability,
  CAMPAIGN_CONFIGURATION_FIELDS,
  type CampaignConfiguration,
  validateCampaignConfiguration,
} from "./campaignConfiguration.js";
import { validateFleetSizeSettings } from "./fleetSize.js";
import { validateResearchSpeedSettings } from "./researchSpeed.js";
import { CANONICAL_SCENARIOS, type ScenarioDefinition, validateScenarios } from "./scenario.js";
import {
  type CampaignTechnologyManifest,
  verifyTechnologyManifest,
} from "./technologyVariation.js";
import { assertCanAdvance, fromLinear, isAtEnd, isBeyondEnd, toLinear } from "./timeline.js";

export { validateCampaignSeed } from "./campaignConfiguration.js";
export {
  assertConfigurationImmutability,
  CAMPAIGN_CONFIGURATION_FIELDS,
  type CampaignConfiguration,
  validateCampaignConfiguration,
};

export function hashConfiguration(cfg: CampaignConfiguration): string {
  return sha256Hex(canonicalSerialize(cfg));
}

// Campaign Session State

export interface CampaignSessionState {
  readonly configuration: CampaignConfiguration;
  readonly configurationHash: string;
  readonly scenarioId: CampaignConfiguration["scenarioId"];
  readonly currentYear: number;
  readonly currentMonth: number; // 1..12
  readonly turnNumber: number; // 0 = start turn
  readonly technologyManifest?: CampaignTechnologyManifest;
  readonly isTerminal: boolean;
}

/**
 * DESIGN-03 §3 + §9.3/9.4: Complete configuration MUST be validated before
 * campaign RNG streams are derived. Invalid -> INVALID_CAMPAIGN_CONFIGURATION
 * and MUST NOT create an active campaign. Runtime inference/fallback prohibited.
 */
function validateScenariosInput(
  input: unknown,
  collector: DiagnosticCollector,
): ScenarioDefinition[] | undefined {
  if (input === undefined) {
    collector.addError(
      "INVALID_SCENARIO_DEFINITION",
      "missing scenarios (fallback to canonical prohibited)",
      { stage: "scenario-validation" },
    );
    return undefined;
  }
  return validateScenarios(input, collector);
}

function validateFleetSizeInput(input: unknown, collector: DiagnosticCollector): boolean {
  if (input === undefined || input === null) {
    collector.addError(
      "MISSING_FLEET_SIZE_MULTIPLIER",
      "fleetSizeSettings must be array of exactly 4 canonical settings (inference prohibited)",
      { stage: "fleet-size" },
    );
    return false;
  }
  return validateFleetSizeSettings(input, collector) !== undefined;
}

function validateResearchSpeedInput(input: unknown, collector: DiagnosticCollector): boolean {
  if (input === undefined || input === null) {
    collector.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      "researchSpeedSettings must be array of exactly 4 canonical settings",
      { stage: "research-speed" },
    );
    return false;
  }
  return validateResearchSpeedSettings(input, collector) !== undefined;
}

// §3 + §1 cross-check: chosen ids must be supported by THE VALIDATED scenario
// (not the canonical constant - compilation must honor the shipped content).
function validateConfigurationSupportedByScenario(
  cfg: CampaignConfiguration,
  scen: ScenarioDefinition,
  stage: string,
  collector: DiagnosticCollector,
): boolean {
  const checks: Array<[string, string, string[]]> = [
    ["fleetSizeSettingId", cfg.fleetSizeSettingId, scen.supportedFleetSizeSettingIds],
    ["researchSpeedSettingId", cfg.researchSpeedSettingId, scen.supportedResearchSpeedSettingIds],
    [
      "technologyVariationSettingId",
      cfg.technologyVariationSettingId,
      scen.supportedTechnologyVariationSettingIds,
    ],
    [
      "historicalBudgetOptionId",
      cfg.historicalBudgetOptionId,
      scen.supportedHistoricalBudgetOptionIds,
    ],
    ["legacyFleetModeId", cfg.legacyFleetModeId, scen.supportedLegacyFleetModeIds],
    ["tacticalRealismModeId", cfg.tacticalRealismModeId, scen.supportedTacticalRealismModeIds],
    ["difficultyProfileId", cfg.difficultyProfileId, scen.supportedDifficultyProfileIds],
  ];
  for (const [field, val, allowed] of checks) {
    if (!allowed.includes(val)) {
      collector.addError(
        "INVALID_CAMPAIGN_CONFIGURATION",
        `${field} "${val}" not supported by scenario ${scen.scenarioId}`,
        { stage },
      );
      return false;
    }
  }
  return true;
}

export function validateCampaignPreconditions(
  input: unknown,
  collector: DiagnosticCollector,
): boolean {
  const anyInput = input as Record<string, unknown>;
  if (typeof anyInput !== "object" || anyInput === null) {
    collector.addError("INVALID_CAMPAIGN_CONFIGURATION", "input must be an object", {
      stage: "campaign-configuration",
    });
    return false;
  }

  // §1: canonical 5 scenarios, January check, INVALID_SCENARIO_DEFINITION - no fallback
  const validatedScenarios = validateScenariosInput(anyInput["scenarios"], collector);
  if (!validatedScenarios) return false;

  // §3: campaignConfiguration mandatory - no omission
  const cfg = anyInput["campaignConfiguration"];
  if (cfg === undefined || cfg === null) {
    collector.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      "missing campaignConfiguration (all 12 fields mandatory, null/omission prohibited)",
      { stage: "campaign-configuration" },
    );
    return false;
  }
  if (!validateCampaignConfiguration(cfg, collector)) return false;

  // §4: fleetSizeSettings mandatory - exactly the canonical settings
  if (!validateFleetSizeInput(anyInput["fleetSizeSettings"], collector)) return false;

  // §5: researchSpeedSettings mandatory - exactly the canonical settings
  if (!validateResearchSpeedInput(anyInput["researchSpeedSettings"], collector)) return false;

  // §3 + §1 cross-check: chosen ids must be supported by THE VALIDATED INPUT scenario
  // (not the canonical constant - compilation must honor the shipped content).
  const typedCfg = cfg as CampaignConfiguration;
  const scen = validatedScenarios.find((s) => s.scenarioId === typedCfg.scenarioId);
  if (
    scen &&
    !validateConfigurationSupportedByScenario(typedCfg, scen, "campaign-configuration", collector)
  ) {
    return false;
  }

  return true;
}

export function createInitialCampaignState(
  configuration: CampaignConfiguration,
  collector: DiagnosticCollector,
): CampaignSessionState | undefined {
  if (!validateCampaignConfiguration(configuration, collector)) return undefined;

  const scen = CANONICAL_SCENARIOS.find((s) => s.scenarioId === configuration.scenarioId);
  if (!scen) {
    collector.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Unknown scenarioId ${configuration.scenarioId}`,
      { stage: "campaign-state" },
    );
    return undefined;
  }
  // supported* cross-check also on direct creation
  if (!validateConfigurationSupportedByScenario(configuration, scen, "campaign-state", collector)) {
    return undefined;
  }

  return {
    configuration,
    configurationHash: hashConfiguration(configuration),
    scenarioId: configuration.scenarioId,
    currentYear: scen.startYear,
    currentMonth: scen.startMonth, // 1 = January per §1
    turnNumber: 0,
    isTerminal: false,
  };
}

/**
 * DESIGN-03 §2: Simulation end = completion of December 1970.
 * Must: 1) complete every phase of Dec 1970, 2) produce MonthClosingSnapshot Dec 1970,
 * 3) terminal evaluation, 4) final career evaluation, 5) reject Jan 1971 with SIMULATION_END_REACHED.
 * Month advancement MUST use integer calendar-month arithmetic.
 */
export function canAdvanceCampaign(state: CampaignSessionState): boolean {
  return (
    !state.isTerminal &&
    !isAtEnd(state.currentYear, state.currentMonth) &&
    !isBeyondEnd(state.currentYear, state.currentMonth)
  );
}

export function advanceCampaignMonth(
  state: CampaignSessionState,
  collector: DiagnosticCollector,
): CampaignSessionState | undefined {
  if (state.isTerminal) {
    collector.addError("SIMULATION_END_REACHED", "Campaign already terminal", {
      stage: "timeline",
    });
    return undefined;
  }
  if (isAtEnd(state.currentYear, state.currentMonth)) {
    collector.addError("SIMULATION_END_REACHED", "Campaign cannot advance beyond December 1970", {
      stage: "timeline",
    });
    return undefined;
  }
  const next = fromLinear(toLinear(state.currentYear, state.currentMonth) + 1);

  if (!assertCanAdvance(state.currentYear, state.currentMonth, next.year, next.month, collector)) {
    return undefined;
  }

  const terminal = isAtEnd(next.year, next.month);
  return {
    ...state,
    currentYear: next.year,
    currentMonth: next.month,
    turnNumber: state.turnNumber + 1,
    isTerminal: terminal,
  };
}

/** Verify technology manifest hash after creation - §6.7 TECHNOLOGY_MANIFEST_MISMATCH */
export function verifyCampaignTechnologyManifest(
  manifest: CampaignTechnologyManifest,
  collector: DiagnosticCollector,
): boolean {
  return verifyTechnologyManifest(manifest, collector);
}

/** Guard §8 post-save mutation: compares hash, fails silent change */
export function assertCampaignStateImmutability(
  saved: CampaignSessionState,
  nextConfig: CampaignConfiguration,
  collector: DiagnosticCollector,
): boolean {
  if (!assertConfigurationImmutability(saved.configuration, nextConfig, collector)) return false;
  if (hashConfiguration(nextConfig) !== saved.configurationHash) {
    collector.addError(
      "INVALID_CAMPAIGN_CONFIGURATION",
      "Configuration hash mismatch - silent migration prohibited without explicit ruleset migration",
      { stage: "campaign-state" },
    );
    return false;
  }
  return true;
}
