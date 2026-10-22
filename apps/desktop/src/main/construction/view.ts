import type { ConstructionCommand } from "@bluewave/campaign-engine";
import type { ConstructionWorkspace } from "./workspaceState.js";

export type ConstructionScreenWorkspace = {
  readonly commands: readonly ConstructionCommand[];
  readonly treasuryReserved: number;
  readonly capacityReserved: number;
};

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
