import {
  decodeWarDeclarationRules,
  type WarDeclarationRulesDecoded,
} from "@bluewave/content-schema";

export function warDeclarationFromRulesets(
  rulesets: readonly unknown[],
): WarDeclarationRulesDecoded | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly warDeclaration?: unknown } | null)?.warDeclaration;
    if (section === undefined) continue;
    return decodeWarDeclarationRules(section);
  }
  return undefined;
}
