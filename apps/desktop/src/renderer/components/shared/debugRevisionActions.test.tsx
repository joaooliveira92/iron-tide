import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { debugRevisionActions } from "./debugRevisionActions.js";

const debugFlag = vi.hoisted(() => ({ on: false }));
vi.mock("../../shell/debug-flag.js", () => ({
  get DEBUG_MODE() {
    return debugFlag.on;
  },
}));

describe("debugRevisionActions (ADR-0058)", () => {
  afterEach(cleanup);

  it("renders nothing at all in a release build", () => {
    debugFlag.on = false;
    expect(debugRevisionActions({ month: 1, year: 1880 }, 7)).toBeUndefined();
  });

  it("shows the month and revision chips in a debug build", () => {
    debugFlag.on = true;
    render(<>{debugRevisionActions({ month: 3, year: 1881 }, 12)}</>);
    expect(screen.getByText("03/1881")).toBeTruthy();
    expect(screen.getByText("REV 12")).toBeTruthy();
  });

  it("omits the month chip when the month is unknown, keeping the revision", () => {
    debugFlag.on = true;
    render(<>{debugRevisionActions(null, 4)}</>);
    expect(screen.queryByText(/\//)).toBeNull();
    expect(screen.getByText("REV 4")).toBeTruthy();
  });
});
