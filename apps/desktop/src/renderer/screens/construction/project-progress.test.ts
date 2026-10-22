import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { projectRow, projectRows } from "./project-progress.js";

const pkg = (id: string, kind: string, total: number, done: number, dependsOn: string[] = []) => ({
  id,
  kind,
  line: "slipway",
  totalWork: total,
  doneWork: done,
  dependsOn,
});
const entry = (
  over: Partial<ConstructionProjectQueueEntry> = {},
): ConstructionProjectQueueEntry => ({
  projectId: "project-1",
  designVersionId: "d",
  className: "Test class",
  shipType: "destroyer",
  status: "ACTIVE",
  totalWork: 100,
  completedWork: 40,
  paidWork: 40,
  startedAt: "1880-01",
  commandId: null,
  revisable: true,
  holdUntilMonth: null,
  isForeign: false,
  ...over,
});
const withPackages = (done: Record<string, number>): ConstructionProjectQueueEntry =>
  entry({
    totalWork: 100,
    completedWork: Object.values(done).reduce((a, b) => a + b, 0),
    packages: [
      pkg("hull", "HULL", 50, done["hull"] ?? 0),
      pkg("machinery", "MACHINERY", 20, done["machinery"] ?? 0),
      pkg("launch", "LAUNCH", 10, done["launch"] ?? 0, ["hull"]),
      pkg("fit_out", "FIT_OUT", 20, done["fit_out"] ?? 0, ["launch", "machinery"]),
    ],
    yardId: "yard_small",
  });
const states = (e: ConstructionProjectQueueEntry) =>
  Object.fromEntries(projectRow(e).packages.map((p) => [p.id, p.state]));

describe("projectRow", () => {
  it("shows overall progress and no packages for a project with one figure", () => {
    const row = projectRow(entry());
    expect(row).toMatchObject({ percent: 40, yard: null, packages: [] });
  });

  it("names the yard and each package, with whole-percent progress", () => {
    const row = projectRow(withPackages({ hull: 25, machinery: 20 }));
    expect(row.yard).toBe("yard small");
    expect(row.packages.map((p) => [p.label, p.percent])).toEqual([
      ["Hull", 50],
      ["Machinery", 100],
      ["Launch", 0],
      ["Fit-out", 0],
    ]);
    expect(row.percent).toBe(45);
  });

  it("marks packages done, in progress, ready to start, or waiting on a dependency", () => {
    expect(states(withPackages({ hull: 25 }))).toEqual({
      hull: "active",
      machinery: "ready",
      launch: "waiting",
      fit_out: "waiting",
    });
    expect(states(withPackages({ hull: 50, machinery: 20 }))).toEqual({
      hull: "done",
      machinery: "done",
      launch: "ready",
      fit_out: "waiting",
    });
    expect(states(withPackages({ hull: 50, machinery: 20, launch: 10, fit_out: 20 }))).toEqual({
      hull: "done",
      machinery: "done",
      launch: "done",
      fit_out: "done",
    });
  });

  it("leaves out a package with no work, and a dependency on it waits for its own dependencies", () => {
    const e = entry({
      totalWork: 10,
      completedWork: 0,
      packages: [
        pkg("hull", "HULL", 10, 0),
        pkg("launch", "LAUNCH", 0, 0, ["hull"]),
        pkg("fit_out", "FIT_OUT", 5, 0, ["launch"]),
      ],
    });
    const row = projectRow(e);
    expect(row.packages.map((p) => p.id)).toEqual(["hull", "fit_out"]);
    expect(row.packages.find((p) => p.id === "fit_out")!.state).toBe("waiting");
  });

  it("falls back to a readable label for an unknown kind, and survives bad numbers", () => {
    const row = projectRow(
      entry({
        totalWork: 0,
        completedWork: 5,
        packages: [pkg("x", "SOMETHING_ELSE", 0, 0), pkg("y", "NEW_KIND", 4, 9)],
      }),
    );
    expect(row.percent).toBe(0);
    expect(row.packages.map((p) => [p.label, p.percent])).toEqual([["new kind", 100]]);
  });

  it("propagates the compiled readout when the entry carries one", () => {
    const readout = {
      totalCostUnits: 640,
      monthlyInstalmentUnits: 120,
      remainingMonths: 6,
      launchMonth: "1880-07",
      scheduleBasis: "YARD_CAPACITY" as const,
      scheduleUnavailableReason: null,
      haltedCarryingCostUnits: 3,
    };
    const row = projectRow(entry({ readout }));
    expect(row.readout).toEqual(readout);
  });

  it("reports no readout as null rather than a fabricated default", () => {
    expect(projectRow(entry({ totalWork: 250 })).readout).toBeNull();
  });
});

describe("projectRows", () => {
  it("lists unfinished projects first, then by id, and keeps the hold month", () => {
    const rows = projectRows([
      entry({ projectId: "project-b", status: "COMPLETED" }),
      entry({ projectId: "project-c", holdUntilMonth: "1880-05" }),
      entry({ projectId: "project-a" }),
    ]);
    expect(rows.map((r) => r.projectId)).toEqual(["project-a", "project-c", "project-b"]);
    expect(rows[1]!.holdUntilMonth).toBe("1880-05");
  });
  it("is empty for no projects and deterministic", () => {
    expect(projectRows([])).toEqual([]);
    const input = [entry({ projectId: "z" }), entry({ projectId: "a" })];
    expect(projectRows(input)).toEqual(projectRows([...input].reverse()));
  });
});
