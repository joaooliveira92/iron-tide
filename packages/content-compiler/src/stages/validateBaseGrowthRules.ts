import { decodeBaseGrowthRules } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function validateBaseGrowthRules(
  rulesets: readonly unknown[],
  nations: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["baseGrowth"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "BASE_GROWTH_RULES_AMBIGUOUS",
      `More than one ruleset carries a baseGrowth section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  const nationIds = new Set(
    nations.map((nation) => String((nation as Record<string, unknown>)["id"])),
  );
  for (const ruleset of carriers) {
    const record = ruleset as Record<string, unknown>;
    const rulesetId = String(record["id"]);
    const decoded = decodeBaseGrowthRules(record["baseGrowth"]);
    if (!decoded.ok) {
      collector.addError(
        "BASE_GROWTH_RULES_INVALID",
        `Ruleset '${rulesetId}' baseGrowth section is invalid at '${decoded.field}': ${decoded.message}`,
        {
          stage: "validate",
          entityId: rulesetId,
          remediation: `Author every baseGrowth rate in ruleset '${rulesetId}' with provenance, or remove the section to leave base growth dormant`,
        },
      );
      continue;
    }
    for (const nationId of Object.keys(decoded.value.nations))
      if (!nationIds.has(nationId))
        collector.addError(
          "BASE_GROWTH_NATION_UNKNOWN",
          `Ruleset '${rulesetId}' baseGrowth names unknown nation '${nationId}'`,
          { stage: "validate", entityId: rulesetId },
        );
  }
}
