import { decodeGunneryRules, type GunneryRules } from "@bluewave/content-schema";
import { Data } from "effect";

export class GunneryRulesError extends Data.TaggedError("GunneryRulesError")<{
  readonly field: string;
  readonly message: string;
}> {}

export function gunneryFromRulesets(rulesets: readonly unknown[]): GunneryRules | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly gunnery?: unknown } | null)?.gunnery;
    if (section === undefined) continue;
    const decoded = decodeGunneryRules(section);
    if (!decoded.ok)
      throw new GunneryRulesError({
        field: decoded.field,
        message: `ruleset gunnery section is invalid at '${decoded.field}': ${decoded.message}`,
      });
    return decoded.value;
  }
  return undefined;
}
