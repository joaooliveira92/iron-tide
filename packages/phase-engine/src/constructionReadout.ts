import { buildConstructionProjectQueueWithReadouts } from "@bluewave/campaign-engine";
import type { CampaignSnapshot } from "@bluewave/campaign";
import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { preservationCostUnits } from "./economyPhases.js";

export function constructionProjectQueueWithReadouts(
  snapshot: CampaignSnapshot,
  nationId: string,
  content: ShipBuildingContent | undefined,
  campaignMonth: string,
): ConstructionProjectQueueEntry[] {
  const haltedCarryingCostUnits =
    content === undefined
      ? null
      : preservationCostUnits(
          content.environmentFor(campaignMonth).constructionBalance,
          content.treasuryUnitMicro,
        );
  return buildConstructionProjectQueueWithReadouts(
    snapshot,
    nationId,
    campaignMonth,
    haltedCarryingCostUnits,
  );
}
