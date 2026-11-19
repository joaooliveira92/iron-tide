import { decodeUnrestRules, type UnrestRulesDecoded } from "@bluewave/content-schema";

export function unrestFromRulesets(rulesets: readonly unknown[]): UnrestRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly unrest?: unknown } | null)?.unrest;
    if (section === undefined) continue;
    return decodeUnrestRules(section);
  }
  return undefined;
}
