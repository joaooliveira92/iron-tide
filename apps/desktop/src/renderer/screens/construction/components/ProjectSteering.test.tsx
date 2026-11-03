import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ProjectRow } from "../project-progress.js";
import { ProjectSteering } from "./ProjectSteering.js";

afterEach(cleanup);

const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  projectId: "project-1",
  className: "Havock class",
  shipType: "destroyer",
  status: "ACTIVE",
  percent: 45,
  yard: null,
  holdUntilMonth: null,
  packages: [],
  isForeign: false,
  revisable: false,
  readout: null,
  ...over,
});

const noop = () => {};
const noop2 = (_id: string, _a: boolean) => {};

describe("ProjectSteering (SB3-R5, SB3-R8)", () => {
  it("offers halt and accelerate for an active project, and issues the command", () => {
    let halted: string | null = null;
    let accelerated: [string, boolean] | null = null;
    render(
      <ProjectSteering
        row={row()}
        pending={false}
        onHalt={(id) => {
          halted = id;
        }}
        onAccelerate={(id, a) => {
          accelerated = [id, a];
        }}
      />,
    );
    const accelerate = screen.getByRole("button", { name: "Havock class accelerate" });
    expect(accelerate.getAttribute("aria-description")).toMatch(/5% cost premium/);
    expect(accelerate.getAttribute("aria-description")).toMatch(/delaying others/);
    screen.getByRole("button", { name: "Havock class halt" }).click();
    accelerate.click();
    expect(halted).toBe("project-1");
    expect(accelerated).toEqual(["project-1", true]);
  });

  it("offers resume for a halted project and stop-accelerating for an accelerated one", () => {
    render(
      <ProjectSteering
        row={row({ status: "HALTED" })}
        pending={false}
        onResume={noop}
        onAccelerate={noop2}
      />,
    );
    expect(screen.getByRole("button", { name: "Havock class resume" })).toBeTruthy();
    cleanup();
    render(
      <ProjectSteering
        row={row({ status: "ACCELERATED" })}
        pending={false}
        onHalt={noop}
        onAccelerate={noop2}
      />,
    );
    expect(screen.getByRole("button", { name: "Havock class stop accelerating" })).toBeTruthy();
  });

  it("offers no steering controls for a foreign-contract project", () => {
    render(
      <ProjectSteering
        row={row({ isForeign: true })}
        pending={false}
        onHalt={noop}
        onResume={noop}
        onAccelerate={noop2}
        onCancelProject={noop}
      />,
    );
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("offers a cancel-project control for a live project and issues it", () => {
    let cancelled: string | null = null;
    render(
      <ProjectSteering
        row={row()}
        pending={false}
        onCancelProject={(id) => {
          cancelled = id;
        }}
      />,
    );
    const cancel = screen.getByRole("button", { name: "Havock class cancel project" });
    expect(cancel.getAttribute("aria-description")).toMatch(/forfeited and is not refunded/);
    expect(cancel.getAttribute("aria-description")).toMatch(/releases its ship/);
    cancel.click();
    expect(cancelled).toBe("project-1");
  });

  it("offers a revise control for a revisable project and issues it", () => {
    let revised: string | null = null;
    render(
      <ProjectSteering
        row={row({ revisable: true })}
        pending={false}
        onRevise={(id) => {
          revised = id;
        }}
      />,
    );
    screen.getByRole("button", { name: "Havock class revise" }).click();
    expect(revised).toBe("project-1");
  });

  it("offers no revise control for an authored, foreign or finished project", () => {
    for (const over of [
      { revisable: false },
      { revisable: true, isForeign: true },
      { revisable: true, status: "CANCELLED" as const },
    ]) {
      render(<ProjectSteering row={row(over)} pending={false} onRevise={noop} />);
      expect(screen.queryByRole("button", { name: "Havock class revise" })).toBeNull();
      cleanup();
    }
  });

  it("offers no cancel control when the screen does not wire it, and locks while pending", () => {
    render(<ProjectSteering row={row()} pending onHalt={noop} />);
    expect(screen.queryByRole("button", { name: "Havock class cancel project" })).toBeNull();
    expect(screen.getByRole("button", { name: "Havock class halt" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
