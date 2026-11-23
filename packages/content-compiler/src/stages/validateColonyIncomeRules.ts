import { decodeColonyIncomeRules } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function validateColonyIncomeRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["colonyIncome"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "COLONY_INCOME_RULES_AMBIGUOUS",
      `More than one ruleset carries a colonyIncome section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of carriers) {
    const record = ruleset as Record<string, unknown>;
    const rulesetId = String(record["id"]);
    const decoded = decodeColonyIncomeRules(record["colonyIncome"]);
    if (decoded.ok) continue;
    collector.addError(
      "COLONY_INCOME_RULES_INVALID",
      `Ruleset '${rulesetId}' colonyIncome section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author the colonyIncome decay curve in ruleset '${rulesetId}' with provenance, or remove the section to leave colony income dormant`,
      },
    );
  }
}
