import { decodePeaceBehaviourRules, decodeTensionDriftRules } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

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

export function validateDiplomacyRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  validateTensionDriftRules(rulesets, collector);
  validatePeaceBehaviourRules(rulesets, collector);
}
