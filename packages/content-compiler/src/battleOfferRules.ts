import { decodeBattleOfferRules, type BattleOfferRules } from "@bluewave/content-schema";

/**
 * The battle-offer ruleset section the pack's rulesets carry, or undefined when none does (dormant, spec #109 R1). The
 * compiler has already rejected a partial, ambiguous or mistyped section, so one that does not decode here is a corrupt
 * artifact: it throws, never silently treated as dormant.
 */
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
