import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { MovementCommandRow } from "../fleet-screen-state.js";
import { MovementCommandsTable, movementStatusVariant } from "./MovementCommandsTable.js";

const debugFlag = vi.hoisted(() => ({ on: false }));
vi.mock("../../../shell/debug-flag.js", () => ({
  get DEBUG_MODE() {
    return debugFlag.on;
  },
}));

const row: MovementCommandRow = {
  commandId: "cmd_movement_0042",
  divisionName: "Home Fleet",
  fromName: "English Home Waters",
  toName: "Malta",
  status: "submitted",
  submittedAtRevision: 9,
};

function renderTable() {
  render(<MovementCommandsTable rows={[row]} />);
}

describe("movementStatusVariant", () => {
  it("maps each engine status to a distinct badge treatment", () => {
    expect(movementStatusVariant("submitted")).toBe("default");
    expect(movementStatusVariant("accepted")).toBe("secondary");
    expect(movementStatusVariant("rejected")).toBe("outline");
    expect(movementStatusVariant("superseded")).toBe("outline");
    expect(movementStatusVariant("cancelled")).toBe("outline");
  });
});

describe("MovementCommandsTable release/debug display (ADR-0058)", () => {
  afterEach(cleanup);

  it("shows readable names and no engine ids or revision in a release build", () => {
    debugFlag.on = false;
    renderTable();
    expect(screen.getByText("Home Fleet")).toBeTruthy();
    expect(screen.getByText("English Home Waters")).toBeTruthy();
    expect(screen.queryByText("cmd_movement_0042")).toBeNull();
    expect(screen.queryByText("Revision")).toBeNull();
    expect(screen.queryByText("9")).toBeNull();
  });

  it("adds the command id and revision columns in a debug build", () => {
    debugFlag.on = true;
    renderTable();
    expect(screen.getByText("cmd_movement_0042")).toBeTruthy();
    expect(screen.getByText("Revision")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("Home Fleet")).toBeTruthy();
  });
});
