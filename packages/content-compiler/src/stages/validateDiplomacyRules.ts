import {
  decodeFleetMoraleRules,
  decodePeaceBehaviourRules,
  decodeTensionDriftRules,
  decodeTradeProtectionRules,
  decodeWarDeclarationRules,
  decodeUnrestRules,
} from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { validateBaseGrowthRules } from "./validateBaseGrowthRules.js";
import { validateColonyIncomeRules } from "./validateColonyIncomeRules.js";
import { validateResearchReturnsRules } from "./validateResearchReturnsRules.js";

function validateTensionDriftRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["tensionDrift"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "TENSION_DRIFT_RULES_AMBIGUOUS",
      `More than one ruleset carries a tensionDrift section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["tensionDrift"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeTensionDriftRules(record["tensionDrift"]);
    if (decoded.ok) continue;
    collector.addError(
      "TENSION_DRIFT_RULES_INVALID",
      `Ruleset '${rulesetId}' tensionDrift section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every tensionDrift value in ruleset '${rulesetId}', or remove the section to leave drift dormant`,
      },
    );
  }
}

function validateFleetMoraleRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["fleetMorale"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "FLEET_MORALE_RULES_AMBIGUOUS",
      `More than one ruleset carries a fleetMorale section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["fleetMorale"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeFleetMoraleRules(record["fleetMorale"]);
    if (decoded.ok) continue;
    collector.addError(
      "FLEET_MORALE_RULES_INVALID",
      `Ruleset '${rulesetId}' fleetMorale section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every fleetMorale value in ruleset '${rulesetId}', or remove the section to leave fleet morale dormant`,
      },
    );
  }
}

function validateTradeProtectionRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["tradeProtection"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "TRADE_PROTECTION_RULES_AMBIGUOUS",
      `More than one ruleset carries a tradeProtection section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of carriers) {
    const record = ruleset as Record<string, unknown>;
    const rulesetId = String(record["id"]);
    const decoded = decodeTradeProtectionRules(record["tradeProtection"]);
    if (decoded.ok) {
      if (!decoded.value.raiderHullTypes.includes(decoded.value.amcHullType))
        collector.addError(
          "TRADE_PROTECTION_AMC_NOT_RAIDER",
          `Ruleset '${rulesetId}' tradeProtection amcHullType '${decoded.value.amcHullType}' is not listed in raiderHullTypes, so its speed floor would never apply`,
          {
            stage: "validate",
            entityId: rulesetId,
            remediation: `Add '${decoded.value.amcHullType}' to raiderHullTypes in ruleset '${rulesetId}', or author a different amcHullType`,
          },
        );
      continue;
    }
    collector.addError(
      "TRADE_PROTECTION_RULES_INVALID",
      `Ruleset '${rulesetId}' tradeProtection section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every tradeProtection value in ruleset '${rulesetId}', or remove the section to leave trade protection dormant`,
      },
    );
  }
}

function validatePeaceBehaviourRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["peaceBehaviour"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "PEACE_BEHAVIOUR_RULES_AMBIGUOUS",
      `More than one ruleset carries a peaceBehaviour section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["peaceBehaviour"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodePeaceBehaviourRules(record["peaceBehaviour"]);
    if (decoded.ok) continue;
    collector.addError(
      "PEACE_BEHAVIOUR_RULES_INVALID",
      `Ruleset '${rulesetId}' peaceBehaviour section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every peaceBehaviour value in ruleset '${rulesetId}', or remove the section to leave AI peace dormant`,
      },
    );
  }
}

function validateWarDeclarationRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["warDeclaration"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "WAR_DECLARATION_RULES_AMBIGUOUS",
      `More than one ruleset carries a warDeclaration section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["warDeclaration"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeWarDeclarationRules(record["warDeclaration"]);
    if (decoded.ok) continue;
    collector.addError(
      "WAR_DECLARATION_RULES_INVALID",
      `Ruleset '${rulesetId}' warDeclaration section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every warDeclaration value in ruleset '${rulesetId}', or remove the section to leave AI war declaration dormant`,
      },
    );
  }
}

export function validateDiplomacyRules(
  rulesets: readonly unknown[],
  nations: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  validateBaseGrowthRules(rulesets, nations, collector);
  validateResearchReturnsRules(rulesets, collector);
  validateColonyIncomeRules(rulesets, collector);
  validateTensionDriftRules(rulesets, collector);
  validatePeaceBehaviourRules(rulesets, collector);
  validateWarDeclarationRules(rulesets, collector);
  validateFleetMoraleRules(rulesets, collector);
  validateTradeProtectionRules(rulesets, collector);
  validateUnrestRules(rulesets, collector);
}

function validateUnrestRules(rulesets: readonly unknown[], collector: DiagnosticCollector): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["unrest"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "UNREST_RULES_AMBIGUOUS",
      `More than one ruleset carries an unrest section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of carriers) {
    const record = ruleset as Record<string, unknown>;
    const rulesetId = String(record["id"]);
    const decoded = decodeUnrestRules(record["unrest"]);
    if (decoded.ok) {
      if (decoded.value.strikeThreshold > decoded.value.revolutionThreshold)
        collector.addError(
          "UNREST_RULES_INVALID",
          `Ruleset '${rulesetId}' unrest strikeThreshold must not exceed revolutionThreshold`,
          { stage: "validate", entityId: rulesetId },
        );
      continue;
    }
    collector.addError(
      "UNREST_RULES_INVALID",
      `Ruleset '${rulesetId}' unrest section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every unrest value in ruleset '${rulesetId}', or remove the section to leave unrest consequences dormant`,
      },
    );
  }
}
