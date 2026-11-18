import { decodeNavigationRules, navigationOrderingIssues } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function validateNavigationRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["navigation"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "NAVIGATION_RULES_AMBIGUOUS",
      `More than one ruleset carries a navigation section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["navigation"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeNavigationRules(record["navigation"]);
    if (!decoded.ok) {
      collector.addError(
        "NAVIGATION_RULES_INVALID",
        `Ruleset '${rulesetId}' navigation section is invalid at '${decoded.field}': ${decoded.message}`,
        {
          stage: "validate",
          entityId: rulesetId,
          remediation: `Author every navigation value in ruleset '${rulesetId}', or remove the section to leave it dormant`,
        },
      );
      continue;
    }
    for (const issue of navigationOrderingIssues(decoded.value))
      collector.addError(
        "NAVIGATION_RULES_ORDERING_INVALID",
        `Ruleset '${rulesetId}' navigation section is inconsistent at '${issue.field}': ${issue.message}`,
        {
          stage: "validate",
          entityId: rulesetId,
          remediation: `Retune '${issue.field}' in ruleset '${rulesetId}'`,
        },
      );
  }
}
