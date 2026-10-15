import type { CommandRecord } from "@bluewave/commands";
import type { ConstructionCommand } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { ConstructionWorkspace } from "./workspaceState.js";

function record(commandId: string, projectedCost = 0, projectedCapacityUnits = 0): CommandRecord {
  return {
    commandId,
    canonicalPayload: { projectedCost, projectedCapacityUnits },
  } as unknown as CommandRecord;
}

describe("ConstructionWorkspace reservations", () => {
  it("holds treasury + capacity and reports the reservation ids", () => {
    const workspace = new ConstructionWorkspace("s", "uk", 100, 3);
    const result = workspace.reserve(record("cmd-1"), {
      projectedCost: 30,
      projectedCapacityUnits: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recordIds).toHaveLength(2);
  });

  it("maps a shortfall onto the domain reason code", () => {
    const workspace = new ConstructionWorkspace("s", "uk", 100, 3);
    expect(
      workspace.reserve(record("cmd-1"), { projectedCost: 200, projectedCapacityUnits: 0 }),
    ).toMatchObject({ ok: false, reasonCode: "INSUFFICIENT_FUNDS" });
    expect(
      workspace.reserve(record("cmd-2"), { projectedCost: 0, projectedCapacityUnits: 9 }),
    ).toMatchObject({ ok: false, reasonCode: "INSUFFICIENT_CAPACITY" });
  });

  it("counts the original's released hold as available for a replacement", () => {
    const workspace = new ConstructionWorkspace("s", "uk", 100, 3);
    workspace.reserve(record("cmd-original"), { projectedCost: 60, projectedCapacityUnits: 1 });

    expect(
      workspace.canReserveReplacement("cmd-original", {
        projectedCost: 90,
        projectedCapacityUnits: 1,
      }),
    ).toEqual({ ok: true });
    expect(
      workspace.canReserveReplacement("cmd-original", {
        projectedCost: 120,
        projectedCapacityUnits: 1,
      }),
    ).toMatchObject({ ok: false, reasonCode: "INSUFFICIENT_FUNDS" });
  });

  it("restoreInFlight re-holds the reservation and resets the row to submitted", () => {
    const workspace = new ConstructionWorkspace("s", "uk", 100, 3);
    const original = record("cmd-1", 60, 1);
    workspace.putRecord(original);
    workspace.reserve(original, { projectedCost: 60, projectedCapacityUnits: 1 });
    workspace.appendCommand({
      commandId: "cmd-1",
      status: "cancelled",
    } as unknown as ConstructionCommand);
    workspace.release("cmd-1");

    workspace.restoreInFlight(original);

    expect(workspace.getRecord("cmd-1")).toBe(original);
    expect(workspace.commandRows()[0]!.status).toBe("submitted");
    expect(
      workspace.canReserveReplacement("cmd-1", { projectedCost: 90, projectedCapacityUnits: 1 }),
    ).toEqual({ ok: true });
  });
});
