import {
  decodePeaceBehaviourRules,
  type PeaceBehaviourRulesDecoded,
} from "@bluewave/content-schema";

export function peaceBehaviourFromRulesets(
  rulesets: readonly unknown[],
): PeaceBehaviourRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly peaceBehaviour?: unknown } | null)?.peaceBehaviour;
    if (section === undefined) continue;
    return decodePeaceBehaviourRules(section);
  }
  return undefined;
}
