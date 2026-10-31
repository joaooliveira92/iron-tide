import { decodeTensionDriftRules, type TensionDriftRulesDecoded } from "@bluewave/content-schema";

export function tensionDriftFromRulesets(
  rulesets: readonly unknown[],
): TensionDriftRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly tensionDrift?: unknown } | null)?.tensionDrift;
    if (section === undefined) continue;
    return decodeTensionDriftRules(section);
  }
  return undefined;
}
