import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ProjectRow } from "../project-progress.js";
import { haltPreview, steeringPreview } from "../steering-test-fixtures.js";
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
  steering: steeringPreview(),
  ...over,
});

const noop = () => {};
const noop2 = (_id: string, _a: boolean) => {};

describe("ProjectSteering (SB3-R5, SB3-R8)", () => {
  it("sends nothing until a steering dialog is confirmed", () => {
    const onHalt = vi.fn();
    const onAccelerate = vi.fn();
    render(
      <ProjectSteering row={row()} pending={false} onHalt={onHalt} onAccelerate={onAccelerate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Havock class halt" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Havock class accelerate" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onHalt).not.toHaveBeenCalled();
    expect(onAccelerate).not.toHaveBeenCalled();
  });

  it("states the months saved, the premium and the delay risk before accelerating", () => {
    const onHalt = vi.fn();
    const onAccelerate = vi.fn();
    render(
      <ProjectSteering row={row()} pending={false} onHalt={onHalt} onAccelerate={onAccelerate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Havock class accelerate" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Accelerate Havock class?")).toBeTruthy();
    expect(within(dialog).getByText("3 months")).toBeTruthy();
    expect(within(dialog).getByText(/a month for each accelerated ship/)).toBeTruthy();
    expect(within(dialog).getByText("Premium")).toBeTruthy();
    expect(within(dialog).getByText("Delay risk")).toBeTruthy();
    expect(within(dialog).getAllByText(/1,200|1200/).length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Accelerate" }));
    expect(onAccelerate).toHaveBeenCalledTimes(1);
    expect(onAccelerate).toHaveBeenCalledWith("project-1", true);
    expect(onHalt).not.toHaveBeenCalled();
  });

  it("states the carrying cost and the resume outcome before halting", () => {
    const onHalt = vi.fn();
    const onAccelerate = vi.fn();
    render(
      <ProjectSteering
        row={row({
          steering: steeringPreview({ halt: haltPreview({ losesAcceleration: true }) }),
        })}
        pending={false}
        onHalt={onHalt}
        onAccelerate={onAccelerate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Havock class halt" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Halt Havock class?")).toBeTruthy();
    expect(within(dialog).getByText("Carrying cost")).toBeTruthy();
    expect(within(dialog).getAllByText(/a month$/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Building again at once")).toBeTruthy();
    expect(within(dialog).getByText(/Acceleration ends/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Halt" }));
    expect(onHalt).toHaveBeenCalledTimes(1);
    expect(onHalt).toHaveBeenCalledWith("project-1");
    expect(onAccelerate).not.toHaveBeenCalled();
  });

  it("explains each previewed figure from its explanation tree", () => {
    render(<ProjectSteering row={row()} pending={false} onHalt={noop} onAccelerate={noop2} />);
    fireEvent.click(screen.getByRole("button", { name: "Havock class accelerate" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.querySelectorAll("details").length).toBe(3);
  });

  it("offers no halt or accelerate when the engine produced no preview for the project", () => {
    render(
      <ProjectSteering
        row={row({ steering: steeringPreview({ accelerate: null, halt: null }) })}
        pending={false}
        onHalt={noop}
        onAccelerate={noop2}
      />,
    );
    expect(screen.queryByRole("button", { name: "Havock class halt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Havock class accelerate" })).toBeNull();
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
