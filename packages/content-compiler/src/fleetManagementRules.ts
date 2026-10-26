import {
  decodeFleetManagementRules,
  type FleetManagementRulesDecoded,
} from "@bluewave/content-schema";

export function fleetManagementFromRulesets(
  rulesets: readonly unknown[],
): FleetManagementRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly fleetManagement?: unknown } | null)?.fleetManagement;
    if (section === undefined) continue;
    return decodeFleetManagementRules(section);
  }
  return undefined;
}
