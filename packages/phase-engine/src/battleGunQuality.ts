import { gunQualityRulesFor, type GunQualityRules } from "@bluewave/combat/battleResolution";
import type { ShipBuildingContent } from "@bluewave/ship-design";

export function gunQualityRulesForBattle(
  content: Pick<ShipBuildingContent, "navalProfileFor"> | undefined,
  nationIds: readonly string[],
  campaignMonth: string,
): GunQualityRules | undefined {
  if (content === undefined) return undefined;
  return gunQualityRulesFor(nationIds, content.navalProfileFor, campaignMonth);
}
