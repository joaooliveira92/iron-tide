import { decodeMissilesRules } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function validateMissilesRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["missiles"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "MISSILES_RULES_AMBIGUOUS",
      `More than one ruleset carries a missiles section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["missiles"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeMissilesRules(record["missiles"]);
    if (decoded.ok) continue;
    collector.addError(
      "MISSILES_RULES_INVALID",
      `Ruleset '${rulesetId}' missiles section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every missiles value in ruleset '${rulesetId}', or remove the section to leave it dormant`,
      },
    );
  }
}
