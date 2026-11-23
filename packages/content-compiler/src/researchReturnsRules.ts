import {
  decodeResearchReturnsRules,
  type ResearchReturnsRulesDecoded,
} from "@bluewave/content-schema";

export function researchReturnsFromRulesets(
  rulesets: readonly unknown[],
): ResearchReturnsRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly researchReturns?: unknown } | null)?.researchReturns;
    if (section === undefined) continue;
    return decodeResearchReturnsRules(section);
  }
  return undefined;
}
