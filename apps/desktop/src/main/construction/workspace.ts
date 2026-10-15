import type { CampaignSessionRecord } from "../campaignSessions.js";
import { constructionEconomy } from "./economy.js";
import { reconstructWorkspaceFromSnapshot } from "./workspaceReconstruction.js";
import { ConstructionWorkspace } from "./workspaceState.js";

/**
 * Session-scoped construction workspace registry and lifecycle.
 *
 * The authoritative record is always the session's `CampaignState` (updated
 * and persisted by `commands/constructionCommands.ts`); each workspace is the
 * append-only command bookkeeping that reflects it to the Construction screen
 * (see `construction/workspaceState.ts` for the encapsulated state machine).
 */
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
  // F1: a fresh session re-opening an existing save directory must see the
  // orders that were queued before the restart — the snapshot still carries
  // their projects, so rebuild the command records + reservations from them.
  reconstructWorkspaceFromSnapshot(workspace, record);
  workspaces.set(record.sessionId, workspace);
  return workspace;
}

/**
 * Re-point both resource pools at the session's current real numbers before
 * each command (`nation.treasury`, shipyard capacity), so reservations can
 * never outrun the current snapshot even after `commitMonth` moved them.
 */
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

/** Drops one session's construction workspace (called when the campaign is closed). */
export function clearConstructionWorkspace(sessionId: string): void {
  workspaces.delete(sessionId);
}

/** True while a construction workspace is held for the session (for teardown tests). */
export function hasConstructionWorkspace(sessionId: string): boolean {
  return workspaces.has(sessionId);
}

/** Test-only: clears every workspace so test files don't leak state. */
export function clearConstructionWorkspacesForTest(): void {
  workspaces.clear();
}
