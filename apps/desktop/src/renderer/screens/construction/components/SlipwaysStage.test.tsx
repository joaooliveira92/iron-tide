import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { axeViolations } from "../../../lib/axe.js";
import type { ProjectRow } from "../project-progress.js";
import { SlipwaysStage } from "./SlipwaysStage.js";

afterEach(cleanup);

const economy = {
  treasury: 1000,
  monthlyAppropriation: 100,
  shipyardCapacity: 50,
  dockMaxBuildDisplacementKg: 13_000_000,
  maxConcurrentConstructionMassKg: 39_000_000,
  committedNewConstructionMassKg: 2_000_000,
  exemptNewConstructionMassKg: 0,
  dockExpansionDurationMonths: 12,
  dockExpansionNextStepKg: null,
  dockPossessions: [],
};

const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  projectId: "project-1",
  className: "Havock class",
  shipType: "destroyer",
  status: "ACTIVE",
  percent: 45,
  yard: "yard small",
  holdUntilMonth: null,
  packages: [
    { id: "hull", label: "Hull", percent: 50, state: "active", dependsOn: [] },
    { id: "machinery", label: "Machinery", percent: 100, state: "done", dependsOn: [] },
    { id: "launch", label: "Launch", percent: 0, state: "waiting", dependsOn: ["Hull"] },
    { id: "fit_out", label: "Fit-out", percent: 0, state: "ready", dependsOn: [] },
  ],
  isForeign: false,
  readout: null,
  ...over,
});

const stage = (rows: readonly ProjectRow[], selectedId: string | null = null) => (
  <SlipwaysStage
    rows={rows}
    economy={economy}
    selectedId={selectedId}
    onSelect={() => {}}
    onBrowseCatalog={() => {}}
  />
);

describe("SlipwaysStage", () => {
  it("shows each ship with its yard, status and overall progress, and each package's state", () => {
    render(stage([row()]));
    const list = screen.getByRole("list", { name: "Ships under construction" });
    expect(within(list).getByText("Havock class")).toBeTruthy();
    expect(within(list).getByText("yard small")).toBeTruthy();
    expect(within(list).getByText("45%")).toBeTruthy();
    expect(within(list).getByText("active")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Havock class progress" })).toBeTruthy();
    const packages = screen.getByRole("list", { name: "Havock class work packages" });
    expect(within(packages).getByRole("group", { name: "Hull: In progress · 50%" })).toBeTruthy();
    expect(within(packages).getByRole("group", { name: "Machinery: Done" })).toBeTruthy();
    expect(within(packages).getByRole("group", { name: "Launch: Waiting" })).toBeTruthy();
    expect(within(packages).getByRole("group", { name: "Fit-out: Ready to start" })).toBeTruthy();
  });

  it("shows only overall progress for a project with one figure, and says when it is on hold", () => {
    render(stage([row({ packages: [], yard: null, holdUntilMonth: "1880-05" })]));
    expect(screen.queryByRole("list", { name: "Havock class work packages" })).toBeNull();
    expect(screen.getByText("on hold until 1880-05")).toBeTruthy();
  });

  it("selects a ship from its lane and reports which is selected", () => {
    let picked: string | null = null;
    render(
      <SlipwaysStage
        rows={[row()]}
        economy={economy}
        selectedId="project-1"
        onSelect={(id) => {
          picked = id;
        }}
        onBrowseCatalog={() => {}}
      />,
    );
    const lane = screen.getByRole("button", { name: "Havock class, active, 45%" });
    expect(lane.getAttribute("aria-pressed")).toBe("true");
    lane.click();
    expect(picked).toBe("project-1");
  });

  it("says so when nothing is under construction, and offers the catalog", () => {
    let browsed = false;
    render(
      <SlipwaysStage
        rows={[]}
        economy={economy}
        selectedId={null}
        onSelect={() => {}}
        onBrowseCatalog={() => {
          browsed = true;
        }}
      />,
    );
    expect(screen.getByText("No ships under construction")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Ships under construction" })).toBeNull();
    screen.getByRole("button", { name: "Browse the design catalog" }).click();
    expect(browsed).toBe(true);
  });

  it("draws the dock gauge from the economy", () => {
    render(stage([]));
    const gauge = screen.getByRole("meter", { name: "Tonnage on the ways" });
    expect(gauge.getAttribute("aria-valuetext")).toBe("2,000 t of 39,000 t");
  });

  it("has no accessibility violations", async () => {
    for (const rows of [[row()], [row({ packages: [], yard: null })], []]) {
      const { container } = render(stage(rows));
      expect(await axeViolations(container)).toEqual([]);
      cleanup();
    }
  });
});
