import type { CampaignSnapshot, EconomyOutlookOptions } from "@bluewave/campaign";
import { constructionProjectQueueWithReadouts } from "@bluewave/phase-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";

export function economyOutlookOptions(
  snapshot: CampaignSnapshot,
  nationId: string,
  content: ShipBuildingContent,
  month: string,
): EconomyOutlookOptions {
  const halted = snapshot.nations
    .get(nationId)
    ?.constructionProjects.some((project) => project.status === "HALTED");
  if (halted !== true) return {};
  const queue = constructionProjectQueueWithReadouts(snapshot, nationId, content, month);
  const carrying = queue.find((entry) => entry.status === "HALTED")?.readout
    ?.haltedCarryingCostUnits;
  return carrying === null || carrying === undefined
    ? {}
    : { carryingCostPerHaltedProject: carrying };
}
