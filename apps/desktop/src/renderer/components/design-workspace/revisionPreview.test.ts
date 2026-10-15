import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "./content.js";
import {
  changeKinds,
  previewRevision,
  progressOf,
  revisableProjects,
  type RevisionProject,
} from "./revisionPreview.js";

const content = loadDrawingBoardContent();
const start = content.references[0]!.draft;
const cat = (id: string) => content.catalogue.find((c) => c.id === id)?.category;
const project = (donePct: number, status = "ACTIVE"): RevisionProject => ({
  projectId: "p1",
  className: "Test",
  status,
  totalWork: 1_000_000,
  completedWork: donePct * 10_000,
});

describe("revision preview", () => {
  it("loads the revision balance from content", () => {
    expect(content.revision!).toMatchObject({
      freeBelowBp: 500,
      revisionBelowBp: 2500,
      redesignBelowBp: 5000,
    });
  });
  it("no edits means no preview", () => {
    expect(changeKinds([], start, start, cat)).toEqual([]);
    expect(previewRevision([], project(10), content.revision!)).toBeNull();
  });
  it("classifies hull geometry edits as structure and fittings as fittings", () => {
    const hull = { kind: "set_hull", patch: { beam: 13000 } } as never;
    const placement = start.placements[0]!;
    const move = {
      kind: "move_placement",
      instanceId: placement.instanceId,
      zoneId: placement.zoneId,
      stationPermille: 100,
    } as never;
    expect(changeKinds([hull], start, start, cat)).toEqual(["STRUCTURE"]);
    // A brief edit is not a build change: it alone never produces a revision.
    const brief = { kind: "set_requirement", patch: { category: "CL" } } as const;
    expect(changeKinds([brief], start, start, cat)).toEqual([]);
    expect(changeKinds([brief, hull], start, start, cat)).toEqual(["STRUCTURE"]);
    expect(changeKinds([move], start, start, cat)).toContain(
      cat(placement.componentId) === "MAIN_GUN" ? "MAIN_ARMAMENT" : "FITTINGS",
    );
  });
  it("tier rises with progress for the same fittings change", () => {
    const tiers = [2, 10, 30, 60].map(
      (p) => previewRevision(["FITTINGS"], project(p), content.revision!)!.tier,
    );
    expect(tiers).toEqual(["T0_FREE", "T1_REVISION", "T2_REDESIGN", "T3_RECONSTRUCTION"]);
  });
  it("T3 asks for a rebuild project; T1 has the spec's minimum delay of one month", () => {
    expect(
      previewRevision(["FITTINGS"], project(60), content.revision!)!.requiresRebuildProject,
    ).toBe(true);
    expect(
      previewRevision(["FITTINGS"], project(10), content.revision!)!.delayMonths,
    ).toBeGreaterThanOrEqual(1);
  });
  it("a project with zero total work is treated as fully progressed, not a divide-by-zero", () => {
    const d = previewRevision(
      ["FITTINGS"],
      { ...project(0), totalWork: 0, completedWork: 0 },
      content.revision!,
    )!;
    expect(d.progressBp).toBe(10_000);
  });
  it("completed projects cannot be revised", () => {
    expect(
      revisableProjects([project(10), project(100, "COMPLETED")]).map((p) => p.status),
    ).toEqual(["ACTIVE"]);
  });
});

describe("progress read from work packages (ADR-0077)", () => {
  const pkg = (
    id: string,
    kind: string,
    line: string,
    total: number,
    done: number,
    dependsOn: string[] = [],
  ) => ({
    id,
    kind,
    line,
    totalWork: total,
    doneWork: done,
    dependsOn,
  });
  const withPackages = (done: Record<string, number>): RevisionProject => {
    const packages = [
      pkg("hull", "HULL", "slipway", 100, done["hull"] ?? 0),
      pkg("machinery", "MACHINERY", "machinery", 40, done["machinery"] ?? 0),
      pkg("armour", "ARMOUR", "armour_plate", 60, done["armour"] ?? 0),
      pkg("launch", "LAUNCH", "slipway", 20, done["launch"] ?? 0, ["hull"]),
    ];
    return {
      ...project(0),
      totalWork: 220,
      completedWork: packages.reduce((a, p) => a + p.doneWork, 0),
      packages,
    };
  };

  it("reads real state: hull share, started armour and machinery, launch", () => {
    expect(progressOf(withPackages({ hull: 50, machinery: 1 }))).toMatchObject({
      hullDoneWork: 50,
      hullTotalWork: 100,
      armourStarted: false,
      machineryStarted: true,
      launched: false,
    });
    expect(progressOf(withPackages({ hull: 100, launch: 20 })).launched).toBe(true);
  });

  it("a launched ship previews as reconstruction, where the single figure would call it a small free change", () => {
    // A hull that is a small share of the work: launched, yet only 2.4% of the project's total work is done.
    const packages = [
      pkg("hull", "HULL", "slipway", 10, 10),
      pkg("launch", "LAUNCH", "slipway", 2, 2, ["hull"]),
      pkg("machinery", "MACHINERY", "machinery", 300, 0),
      pkg("armour", "ARMOUR", "armour_plate", 188, 0),
    ];
    const launched: RevisionProject = {
      ...project(0),
      totalWork: 500,
      completedWork: 12,
      packages,
    };
    const rules = content.revision!;
    expect(previewRevision(["FITTINGS"], launched, rules)?.tier).toBe("T3_RECONSTRUCTION");
    const single: RevisionProject = { ...launched, packages: undefined };
    expect(previewRevision(["FITTINGS"], single, rules)?.tier).toBe("T0_FREE");
  });

  it("keeps the one-figure reading when there are no packages, or one is not recognised", () => {
    const plain = project(40);
    expect(progressOf(plain)).toMatchObject({
      hullDoneWork: plain.completedWork,
      launched: false,
      armourStarted: false,
    });
    const odd: RevisionProject = {
      ...project(40),
      packages: [pkg("x", "NOT_A_KIND", "slipway", 10, 5)],
    };
    expect(progressOf(odd).hullDoneWork).toBe(odd.completedWork);
  });
});
