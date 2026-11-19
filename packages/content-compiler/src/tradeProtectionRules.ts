import {
  decodeTradeProtectionRules,
  type TradeProtectionRulesDecoded,
} from "@bluewave/content-schema";

export function tradeProtectionFromRulesets(
  rulesets: readonly unknown[],
): TradeProtectionRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly tradeProtection?: unknown } | null)?.tradeProtection;
    if (section === undefined) continue;
    return decodeTradeProtectionRules(section);
  }
  return undefined;
}
