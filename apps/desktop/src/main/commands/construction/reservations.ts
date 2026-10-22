import type { CommandRecord } from "@bluewave/commands";
import type { CampaignSessionRecord } from "../../campaignSessions.js";
import { syncReservationPools } from "../../construction/workspace.js";
import type {
  ConstructionWorkspace,
  ProjectedCosts,
  ReservationFailure,
  ReserveOrderResult,
} from "../../construction/workspaceState.js";

export function reserveForOrder(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
  recordRef: CommandRecord,
  costs: ProjectedCosts,
): ReserveOrderResult {
  syncReservationPools(workspace, record);
  return workspace.reserve(recordRef, costs);
}

export function canReserveReplacement(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
  originalCommandId: string,
  costs: ProjectedCosts,
): { readonly ok: true } | ReservationFailure {
  syncReservationPools(workspace, record);
  return workspace.canReserveReplacement(originalCommandId, costs);
}

export function restoreInFlight(workspace: ConstructionWorkspace, original: CommandRecord): void {
  workspace.restoreInFlight(original);
}
