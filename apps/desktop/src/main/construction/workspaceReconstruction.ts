import type { CommandRecord } from "@bluewave/commands";
import {
  constructionCommandIdForProject,
  projectedConstructionOrderCosts,
} from "@bluewave/campaign-engine";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { resolveUiDesign, toUiCommand } from "../commands/construction/command-view.js";
import { acceptConstructionRecord } from "./commandRecord.js";
import type { ConstructionWorkspace } from "./workspaceState.js";

/**
 * Rebuilds the per-command bookkeeping (records + reservations + UI rows) for
 * every order-queued project still in the snapshot when a fresh session opens
 * an existing save directory. Without this a restart would empty the
 * workspace and cancel/replace on a pre-restart order would return
 * COMMAND_NOT_FOUND even though the order's project is still authoritative.
 *
 * Reconstruction is fully deterministic:
 * - the commandId is recovered from the project id (`project-<commandId
 *   minus cmd->`, the exact pairing `constructionCommands.ts` writes), so
 *   cancel/replace resolve to the same commandId the renderer's rows show;
 * - projected costs come from the same design formula the original
 *   submission used (`projectedConstructionOrderCosts`), so the re-held
 *   reservation matches what was originally committed;
 * - status walks to ACCEPTED (in-flight) exactly like a fresh submission.
 *
 * Authored starting projects (`con_...` ids) have no command record behind
 * them and are left alone (they surface through the screen's `projects`
 * projection instead). Idempotency keys are NOT reconstructed — the original
 * `transportRequestId` is unrecoverable from the snapshot — so a retried
 * transportRequestId after a restart is treated as a fresh request.
 */
export function reconstructWorkspaceFromSnapshot(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
): void {
  const nation = record.state.snapshot.nations.get(record.playerSlotId);
  const projects = nation?.constructionProjects ?? [];
  const revision = Number(record.state.snapshot.turnNumber);
  for (const project of projects) {
    const commandId = constructionCommandIdForProject(project.id);
    if (!commandId) continue; // authored start — no command record exists
    const design = record.state.snapshot.designs.get(project.designVersionId);
    const costs = design
      ? projectedConstructionOrderCosts(design)
      : { projectedCost: Number(project.totalWork), projectedCapacityUnits: 0 };
    const recordRef = acceptConstructionRecord(
      workspace,
      record,
      commandId,
      commandId, // deterministic placeholder — the original key is unrecoverable
      revision,
      project.designVersionId,
      costs.projectedCost,
      costs.projectedCapacityUnits,
    );
    const result = workspace.reserve(recordRef, costs);
    if (!result.ok) continue; // unreachable: pools are synced from this same snapshot
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
