import {
  decodeEventResolutionRules,
  type EventResolutionRulesDecoded,
} from "@bluewave/content-schema";

export function eventResolutionFromRulesets(
  rulesets: readonly unknown[],
): EventResolutionRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly eventResolution?: unknown } | null)?.eventResolution;
    if (section === undefined) continue;
    return decodeEventResolutionRules(section);
  }
  return undefined;
}
