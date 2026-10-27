import { decodeMissilesRules, type MissilesRules } from "@bluewave/content-schema";
import { Data } from "effect";

export class MissilesRulesError extends Data.TaggedError("MissilesRulesError")<{
  readonly field: string;
  readonly message: string;
}> {}

export function missilesFromRulesets(rulesets: readonly unknown[]): MissilesRules | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly missiles?: unknown } | null)?.missiles;
    if (section === undefined) continue;
    const decoded = decodeMissilesRules(section);
    if (!decoded.ok)
      throw new MissilesRulesError({
        field: decoded.field,
        message: `ruleset missiles section is invalid at '${decoded.field}': ${decoded.message}`,
      });
    return decoded.value;
  }
  return undefined;
}
