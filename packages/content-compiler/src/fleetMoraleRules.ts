import { decodeFleetMoraleRules, type FleetMoraleRulesDecoded } from "@bluewave/content-schema";

export function fleetMoraleFromRulesets(
  rulesets: readonly unknown[],
): FleetMoraleRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly fleetMorale?: unknown } | null)?.fleetMorale;
    if (section === undefined) continue;
    return decodeFleetMoraleRules(section);
  }
  return undefined;
}
