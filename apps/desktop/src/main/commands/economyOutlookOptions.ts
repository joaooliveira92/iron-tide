import type { CampaignSnapshot, EconomyOutlookOptions } from "@bluewave/campaign";
import { accelerationTermsFor, constructionProjectQueueWithReadouts } from "@bluewave/phase-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";

export function economyOutlookOptions(
  snapshot: CampaignSnapshot,
  nationId: string,
  content: ShipBuildingContent,
  month: string,
): EconomyOutlookOptions {
  const projects = snapshot.nations.get(nationId)?.constructionProjects ?? [];
  const terms = accelerationTermsFor(content, month);
  const base: EconomyOutlookOptions = terms === undefined ? {} : { acceleration: terms };
  const halted = projects.some((project) => project.status === "HALTED");
  if (!halted) return base;
  const queue = constructionProjectQueueWithReadouts(snapshot, nationId, content, month);
  const carrying = queue.find((entry) => entry.status === "HALTED")?.readout
    ?.haltedCarryingCostUnits;
  return carrying === null || carrying === undefined
    ? base
    : { ...base, carryingCostPerHaltedProject: carrying };
}
