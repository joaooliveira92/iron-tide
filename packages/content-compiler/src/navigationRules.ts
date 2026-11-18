import { decodeNavigationRules, type NavigationRulesDecoded } from "@bluewave/content-schema";

export function navigationFromRulesets(
  rulesets: readonly unknown[],
): NavigationRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly navigation?: unknown } | null)?.navigation;
    if (section === undefined) continue;
    return decodeNavigationRules(section);
  }
  return undefined;
}
