import type { ConstructionCommand } from "@bluewave/campaign-engine";
import type { ConstructionWorkspace } from "./workspaceState.js";

/** The UI-facing command list plus the reserved totals the projection exposes. */
export type ConstructionScreenWorkspace = {
  readonly commands: readonly ConstructionCommand[];
  readonly treasuryReserved: number;
  readonly capacityReserved: number;
};

/**
 * Project the workspace's in-flight commands and their reservation totals for
 * the Construction screen: only `submitted` rows still hold a reservation
 * (superseded/cancelled rows have already been released).
 */
export function workspaceView(workspace: ConstructionWorkspace): ConstructionScreenWorkspace {
  const commands = workspace.commandRows();
  let treasuryReserved = 0;
  let capacityReserved = 0;
  for (const command of commands) {
    if (uiCommandHoldsReservation(command)) {
      treasuryReserved += command.projectedCost;
      capacityReserved += command.projectedCapacityUnits;
    }
  }
  return { commands, treasuryReserved, capacityReserved };
}

function uiCommandHoldsReservation(command: ConstructionCommand): boolean {
  return command.status === "submitted";
}
