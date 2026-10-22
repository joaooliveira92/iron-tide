import { decodeBattleOfferRules, type BattleOfferRules } from "@bluewave/content-schema";

export function battleOffersFromRulesets(
  rulesets: readonly unknown[],
): BattleOfferRules | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly battleOffers?: unknown } | null)?.battleOffers;
    if (section === undefined) continue;
    const decoded = decodeBattleOfferRules(section);
    if (!decoded.ok)
      throw new Error(
        `ruleset battleOffers section is invalid at '${decoded.field}': ${decoded.message}`,
      );
    return decoded.value;
  }
  return undefined;
}
