import { decodeColonyIncomeRules, type ColonyIncomeRulesDecoded } from "@bluewave/content-schema";

export function colonyIncomeFromRulesets(
  rulesets: readonly unknown[],
): ColonyIncomeRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly colonyIncome?: unknown } | null)?.colonyIncome;
    if (section === undefined) continue;
    return decodeColonyIncomeRules(section);
  }
  return undefined;
}
