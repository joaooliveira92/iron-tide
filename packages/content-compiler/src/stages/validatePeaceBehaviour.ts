import { decodePeaceBehaviourRules } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function validatePeaceBehaviourRules(
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
