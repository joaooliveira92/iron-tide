import type { CampaignSessionRecord } from "../campaignSessions.js";
import { constructionEconomy } from "./economy.js";
import { reconstructWorkspaceFromSnapshot } from "./workspaceReconstruction.js";
import { ConstructionWorkspace } from "./workspaceState.js";

const workspaces = new Map<string, ConstructionWorkspace>();

export function getConstructionWorkspace(record: CampaignSessionRecord): ConstructionWorkspace {
  const existing = workspaces.get(record.sessionId);
  if (existing) {
    syncReservationPools(existing, record);
    return existing;
  }

  const economy = constructionEconomy(record);
  const workspace = new ConstructionWorkspace(
    record.sessionId,
    record.playerSlotId,
    economy.treasury,
    economy.shipyardCapacity,
  );
  reconstructWorkspaceFromSnapshot(workspace, record);
  workspaces.set(record.sessionId, workspace);
  return workspace;
}

export function syncReservationPools(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
): void {
  const nation = record.state.snapshot.nations.get(record.playerSlotId);
  workspace.syncPools(
    nation ? Number(nation.treasury) : 0,
    constructionEconomy(record).shipyardCapacity,
  );
}

export function clearConstructionWorkspace(sessionId: string): void {
  workspaces.delete(sessionId);
}

export function hasConstructionWorkspace(sessionId: string): boolean {
  return workspaces.has(sessionId);
}

export function clearConstructionWorkspacesForTest(): void {
  workspaces.clear();
}
