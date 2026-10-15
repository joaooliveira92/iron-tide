import type { CampaignSnapshot } from "@bluewave/campaign";
import { constructionProjectIdForCommand } from "@bluewave/campaign-engine";

/**
 * Pure snapshot edit for cancelling a construction order: removing the queued
 * `ConstructionProject` of a command from a nation.
 * Kept free of persistence and session concerns so they can be unit-tested and
 * reused by any snapshot writer.
 */

/** Building a new order's project is the engine-side `placeConstructionOrder` policy; re-exported for its unit tests. */
export { constructionProjectFor } from "@bluewave/phase-engine";

export function removeProjectForCommand(
  snapshot: CampaignSnapshot,
  playerSlotId: string,
  commandId: string,
): CampaignSnapshot {
  const nation = snapshot.nations.get(playerSlotId);
  if (!nation) return snapshot;
  const projectId = constructionProjectIdForCommand(commandId);
  const updatedNations = new Map(snapshot.nations).set(playerSlotId, {
    ...nation,
    constructionProjects: nation.constructionProjects.filter((project) => project.id !== projectId),
  });
  return { ...snapshot, nations: updatedNations };
}
