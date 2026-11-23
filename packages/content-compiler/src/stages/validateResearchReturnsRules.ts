import { decodeResearchReturnsRules } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function validateResearchReturnsRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["researchReturns"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "RESEARCH_RETURNS_RULES_AMBIGUOUS",
      `More than one ruleset carries a researchReturns section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of carriers) {
    const record = ruleset as Record<string, unknown>;
    const rulesetId = String(record["id"]);
    const decoded = decodeResearchReturnsRules(record["researchReturns"]);
    if (decoded.ok) continue;
    collector.addError(
      "RESEARCH_RETURNS_RULES_INVALID",
      `Ruleset '${rulesetId}' researchReturns section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author the researchReturns threshold and marginal rate in ruleset '${rulesetId}' with provenance, or remove the section to leave research returns linear`,
      },
    );
  }
}
