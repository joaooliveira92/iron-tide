import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { axeViolations } from "../../../lib/axe.js";
import type { ProjectRow } from "../project-progress.js";
import { ProjectsCard } from "./ProjectsCard.js";

afterEach(cleanup);

const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  projectId: "project-1",
  className: "Havock class",
  status: "ACTIVE",
  percent: 45,
  yard: "yard small",
  holdUntilMonth: null,
  packages: [
    { id: "hull", label: "Hull", percent: 50, state: "active" },
    { id: "machinery", label: "Machinery", percent: 100, state: "done" },
    { id: "launch", label: "Launch", percent: 0, state: "waiting" },
    { id: "fit_out", label: "Fit-out", percent: 0, state: "ready" },
  ],
  isForeign: false,
  readout: {
    totalCostUnits: 100,
    monthlyInstalmentUnits: 0,
    remainingMonths: 0,
    launchMonth: null,
    scheduleBasis: "YARD_CAPACITY",
    scheduleUnavailableReason: null,
    haltedCarryingCostUnits: null,
  },
  ...over,
});

describe("ProjectsCard", () => {
  it("shows the ship, its yard and overall progress, with each package's state", () => {
    render(<ProjectsCard rows={[row()]} />);
    const list = screen.getByRole("list", { name: "Ships under construction" });
    expect(within(list).getByText("Havock class")).toBeTruthy();
    expect(within(list).getByText("yard small")).toBeTruthy();
    expect(within(list).getByText("45%")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Havock class progress" })).toBeTruthy();
    const packages = screen.getByRole("list", { name: "Havock class work packages" });
    expect(within(packages).getByText("In progress · 50%")).toBeTruthy();
    expect(within(packages).getByText("Done")).toBeTruthy();
    expect(within(packages).getByText("Waiting")).toBeTruthy();
    expect(within(packages).getByText("Ready to start")).toBeTruthy();
  });

  it("explains work packages only when some ship has them", () => {
    const { unmount } = render(<ProjectsCard rows={[row()]} />);
    expect(screen.getByText(/built in work packages/)).toBeTruthy();
    unmount();
    render(<ProjectsCard rows={[row({ packages: [], yard: null })]} />);
    expect(screen.queryByText(/built in work packages/)).toBeNull();
    expect(screen.getByText("How far each ship is along.")).toBeTruthy();
  });

  it("shows only overall progress for a project with one figure, and says when it is on hold", () => {
    render(<ProjectsCard rows={[row({ packages: [], yard: null, holdUntilMonth: "1880-05" })]} />);
    expect(screen.queryByRole("list", { name: "Havock class work packages" })).toBeNull();
    expect(screen.getByText("on hold until 1880-05")).toBeTruthy();
  });

  it("says so when nothing is under construction", () => {
    render(<ProjectsCard rows={[]} />);
    expect(screen.getByText("No ships under construction")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Ships under construction" })).toBeNull();
  });

  it("shows the compiled instalment, months left, total cost and launch month for a row with a readout", () => {
    render(
      <ProjectsCard
        rows={[
          row({
            readout: {
              totalCostUnits: 640,
              monthlyInstalmentUnits: 120,
              remainingMonths: 6,
              launchMonth: "1880-07",
              scheduleBasis: "YARD_CAPACITY",
              scheduleUnavailableReason: null,
              haltedCarryingCostUnits: null,
            },
          }),
        ]}
      />,
    );
    const readout = screen.getByRole("list", { name: "Havock class cost and schedule" });
    expect(within(readout).getByText("120 NC/mo")).toBeTruthy();
    expect(within(readout).getByText("6")).toBeTruthy();
    expect(within(readout).getByText("640 NC")).toBeTruthy();
    expect(within(readout).getByText("1880-07")).toBeTruthy();
  });

  it("has no accessibility violations in any of those states", async () => {
    for (const rows of [[row()], [row({ packages: [], yard: null })], []]) {
      const { container } = render(<ProjectsCard rows={rows} />);
      expect(await axeViolations(container)).toEqual([]);
      cleanup();
    }
  });
});

describe("ProjectsCard steering controls (SB3-R5, SB3-R8)", () => {
  const noop = () => {};
  const noop2 = (_id: string, _a: boolean) => {};

  it("offers halt and accelerate for an active project, and issues the command", () => {
    let halted: string | null = null;
    let accelerated: [string, boolean] | null = null;
    render(
      <ProjectsCard
        rows={[row()]}
        onHalt={(id) => {
          halted = id;
        }}
        onAccelerate={(id, a) => {
          accelerated = [id, a];
        }}
      />,
    );
    const halt = screen.getByRole("button", { name: "Havock class halt" });
    const accelerate = screen.getByRole("button", { name: "Havock class accelerate" });
    // The acceleration control discloses the 5% premium and the capacity-pressure risk (SB3-R32).
    expect(accelerate.getAttribute("title")).toMatch(/5% cost premium/);
    expect(accelerate.getAttribute("title")).toMatch(/delaying others/);
    halt.click();
    accelerate.click();
    expect(halted).toBe("project-1");
    expect(accelerated).toEqual(["project-1", true]);
  });

  it("offers resume for a halted project and stop-accelerating for an accelerated one", () => {
    render(
      <ProjectsCard rows={[row({ status: "HALTED" })]} onResume={noop} onAccelerate={noop2} />,
    );
    expect(screen.getByRole("button", { name: "Havock class resume" })).toBeTruthy();
    cleanup();
    render(
      <ProjectsCard rows={[row({ status: "ACCELERATED" })]} onHalt={noop} onAccelerate={noop2} />,
    );
    expect(screen.getByRole("button", { name: "Havock class stop accelerating" })).toBeTruthy();
  });

  it("offers no steering controls for a foreign-contract project (its work follows the contract schedule)", () => {
    render(
      <ProjectsCard
        rows={[row({ isForeign: true })]}
        onHalt={noop}
        onResume={noop}
        onAccelerate={noop2}
        onCancelProject={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: "Havock class accelerate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Havock class halt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Havock class resume" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Havock class cancel project" })).toBeNull();
    // The status badge still shows the project's state.
    expect(screen.getByText("active")).toBeTruthy();
  });

  it("offers a cancel-project control for a live project and issues it (DESIGN-23 section 23)", () => {
    let cancelled: string | null = null;
    render(
      <ProjectsCard
        rows={[row()]}
        onCancelProject={(id) => {
          cancelled = id;
        }}
      />,
    );
    const cancel = screen.getByRole("button", { name: "Havock class cancel project" });
    // The control discloses the non-refundable settlement and the ship release.
    expect(cancel.getAttribute("title")).toMatch(/forfeited and is not refunded/);
    expect(cancel.getAttribute("title")).toMatch(/releases its ship/);
    cancel.click();
    expect(cancelled).toBe("project-1");
  });

  it("offers no cancel control when the screen does not wire it", () => {
    render(<ProjectsCard rows={[row()]} onHalt={noop} />);
    expect(screen.queryByRole("button", { name: "Havock class cancel project" })).toBeNull();
  });
});
