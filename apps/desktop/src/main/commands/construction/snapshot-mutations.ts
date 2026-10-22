import type { CampaignSnapshot } from "@bluewave/campaign";
import { constructionProjectIdForCommand } from "@bluewave/campaign-engine";

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
