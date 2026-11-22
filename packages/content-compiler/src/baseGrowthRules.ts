import { decodeBaseGrowthRules, type BaseGrowthRulesDecoded } from "@bluewave/content-schema";

export function baseGrowthFromRulesets(
  rulesets: readonly unknown[],
): BaseGrowthRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly baseGrowth?: unknown } | null)?.baseGrowth;
    if (section === undefined) continue;
    return decodeBaseGrowthRules(section);
  }
  return undefined;
}
