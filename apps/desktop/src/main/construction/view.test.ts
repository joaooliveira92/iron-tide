import type { ConstructionCommand } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { workspaceView } from "./view.js";
import { ConstructionWorkspace } from "./workspaceState.js";

function row(
  commandId: string,
  status: ConstructionCommand["status"],
  projectedCost: number,
  projectedCapacityUnits: number,
): ConstructionCommand {
  return {
    commandId,
    status,
    projectedCost,
    projectedCapacityUnits,
  } as unknown as ConstructionCommand;
}

describe("workspaceView", () => {
  it("preserves submission order and sums reservations for submitted rows only", () => {
    const workspace = new ConstructionWorkspace("s", "uk", 100, 5);
    workspace.appendCommand(row("a", "submitted", 30, 2));
    workspace.appendCommand(row("b", "cancelled", 10, 1));
    workspace.appendCommand(row("c", "superseded", 5, 1));

    const view = workspaceView(workspace);
    expect(view.commands.map((command) => command.commandId)).toEqual(["a", "b", "c"]);
    expect(view.treasuryReserved).toBe(30);
    expect(view.capacityReserved).toBe(2);
  });
});
