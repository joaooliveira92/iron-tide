import type { CommandRecord } from "@bluewave/commands";
import type { CampaignSessionRecord } from "../../campaignSessions.js";
import { syncReservationPools } from "../../construction/workspace.js";
import type {
  ConstructionWorkspace,
  ProjectedCosts,
  ReservationFailure,
  ReserveOrderResult,
} from "../../construction/workspaceState.js";

/**
 * Thin command-flow adapters over the workspace's reservation operations.
 *
 * Each re-points the pools at the session's current numbers (`syncReservationPools`)
 * and then delegates the hold / preflight / rollback arithmetic to
 * `ConstructionWorkspace`, which privately owns the pools and enforces the
 * invariants. The command flows never touch raw pool state.
 */

/** Hold the projected treasury + capacity for a freshly accepted order. */
export function reserveForOrder(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
  recordRef: CommandRecord,
  costs: ProjectedCosts,
): ReserveOrderResult {
  syncReservationPools(workspace, record);
  return workspace.reserve(recordRef, costs);
}

/**
 * F2 preflight: would the replacement's reservation fit once the original's
 * supersession releases its hold? Run against the CURRENT pools with the
 * original's released hold counted as available — so a rejected replace never
 * mutates or persists anything.
 */
export function canReserveReplacement(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
  originalCommandId: string,
  costs: ProjectedCosts,
): { readonly ok: true } | ReservationFailure {
  syncReservationPools(workspace, record);
  return workspace.canReserveReplacement(originalCommandId, costs);
}

/**
 * F2 rollback: restore a command that was settled/released back to a pristine
 * in-flight state (see `ConstructionWorkspace.restoreInFlight`). Used when a
 * cancel/replace's persist fails, so the workspace can never report a terminal
 * outcome the package doesn't reflect.
 */
export function restoreInFlight(workspace: ConstructionWorkspace, original: CommandRecord): void {
  workspace.restoreInFlight(original);
}
