import { decodePresenceRules } from "@bluewave/content-schema";

/** The S-5 values a pack's rulesets carry, as the ship-building content reads them (ADR-0242). */
export interface PresenceValues {
  readonly colonialServiceDisplacementBp: number;
}

/**
 * The S-5 presence values the pack's rulesets carry, or undefined when none does (dormant). The compiler has already
 * rejected a partial, ambiguous or mistyped section, so one that does not decode here is a corrupt artifact: it throws,
 * never silently treated as dormant.
 */
export function presenceFromRulesets(rulesets: readonly unknown[]): PresenceValues | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly presence?: unknown } | null)?.presence;
    if (section === undefined) continue;
    const decoded = decodePresenceRules(section);
    if (!decoded.ok)
      throw new Error(
        `ruleset presence section is invalid at '${decoded.field}': ${decoded.message}`,
      );
    return { colonialServiceDisplacementBp: decoded.value.colonialServiceDisplacementBp };
  }
  return undefined;
}
