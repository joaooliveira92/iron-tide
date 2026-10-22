import type { CommandRecord } from "@bluewave/commands";
import {
  constructionCommandIdForProject,
  projectedConstructionOrderCosts,
} from "@bluewave/campaign-engine";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { resolveUiDesign, toUiCommand } from "../commands/construction/command-view.js";
import { acceptConstructionRecord } from "./commandRecord.js";
import type { ConstructionWorkspace } from "./workspaceState.js";

export function reconstructWorkspaceFromSnapshot(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
): void {
  const nation = record.state.snapshot.nations.get(record.playerSlotId);
  const projects = nation?.constructionProjects ?? [];
  const revision = Number(record.state.snapshot.turnNumber);
  for (const project of projects) {
    const commandId = constructionCommandIdForProject(project.id);
    if (!commandId) continue;
    const design = record.state.snapshot.designs.get(project.designVersionId);
    const costs = design
      ? projectedConstructionOrderCosts(design)
      : { projectedCost: Number(project.totalWork), projectedCapacityUnits: 0 };
    const recordRef = acceptConstructionRecord(
      workspace,
      record,
      commandId,
      commandId,
      revision,
      project.designVersionId,
      costs.projectedCost,
      costs.projectedCapacityUnits,
    );
    const result = workspace.reserve(recordRef, costs);
    if (!result.ok) continue;
    const accepted: CommandRecord = {
      ...recordRef,
      reservationRecordIds: result.recordIds,
    };
    workspace.putRecord(accepted);
    workspace.appendCommand(
      toUiCommand({
        recordRef: accepted,
        designId: project.designVersionId,
        design: resolveUiDesign(record, project.designVersionId),
        projectedCost: costs.projectedCost,
        projectedCapacityUnits: costs.projectedCapacityUnits,
        submittedAtRevision: revision,
      }),
    );
  }
}
