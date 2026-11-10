import type { ConstructionPackage, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";

import { constructionOverrunSubject, withConstructionOverrun } from "../src/constructionOverrun.js";

const pkg = (id: string, total: number, done: number): ConstructionPackage => ({
  id,
  kind: "HULL",
  line: "HULL",
  totalWork: SafeInt(total),
  doneWork: SafeInt(done),
  dependsOn: [],
});

const project = (over: Partial<ConstructionProject> = {}): ConstructionProject => ({
  id: "p-1",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "ship-x",
  designVersionId: "d1",
  totalWork: SafeInt(600),
  completedWork: SafeInt(150),
  paidWork: SafeInt(150),
  status: "ACTIVE",
  startedAt: "1880-01",
  packages: [pkg("a", 200, 200), pkg("b", 200, 0), pkg("c", 200, 100)],
  ...over,
});

const sum = (list: readonly ConstructionPackage[], key: "totalWork" | "doneWork"): number =>
  list.reduce((a, p) => a + Number(p[key]), 0);

describe("withConstructionOverrun", () => {
  it("spreads the added work over unfinished packages only and keeps the totals consistent", () => {
    const next = withConstructionOverrun(project(), 30, "DESIGN_CHANGE_REWORK", "1880-03");
    expect(Number(next.totalWork)).toBe(630);
    expect(sum(next.packages!, "totalWork")).toBe(630);
    expect(sum(next.packages!, "doneWork")).toBe(300);
    expect(next.packages!.map((p) => Number(p.totalWork))).toEqual([200, 220, 210]);
    expect(Number(next.completedWork)).toBe(150);
    expect(next.overruns).toEqual([
      { month: "1880-03", reasonCode: "DESIGN_CHANGE_REWORK", amount: 30 },
    ]);
  });

  it("hands the rounding remainder to the largest remainders, ties by package id", () => {
    const next = withConstructionOverrun(
      project({ packages: [pkg("b", 100, 0), pkg("a", 100, 0), pkg("c", 100, 0)] }),
      2,
      "X",
      "1880-03",
    );
    expect(Object.fromEntries(next.packages!.map((p) => [p.id, Number(p.totalWork)]))).toEqual({
      a: 101,
      b: 101,
      c: 100,
    });
  });

  it("raises the total of an unpackaged project", () => {
    const { packages: _packages, ...flat } = project();
    const next = withConstructionOverrun(flat, 12, "X", "1880-03");
    expect(Number(next.totalWork)).toBe(612);
    expect(next.packages).toBeUndefined();
  });

  it("appends to the project's history and never mutates its input", () => {
    const first = withConstructionOverrun(project(), 10, "A", "1880-03");
    const second = withConstructionOverrun(first, 5, "B", "1880-04");
    expect(second.overruns?.map((o) => o.reasonCode)).toEqual(["A", "B"]);
    expect(first.overruns).toHaveLength(1);
    expect(Number(project().totalWork)).toBe(600);
  });
});

describe("constructionOverrunSubject", () => {
  it("measures remaining work, cumulative overrun and the original total", () => {
    const hit = withConstructionOverrun(project(), 30, "A", "1880-03");
    expect(constructionOverrunSubject(hit)).toEqual({
      id: "p-1",
      status: "ACTIVE",
      homeBuild: true,
      remainingWork: 480,
      originalWork: 600,
      overrunWork: 30,
    });
  });

  it("is a home build only for a ship of new construction or rebuild without a foreign contract", () => {
    expect(constructionOverrunSubject(project({ projectType: "REBUILD" })).homeBuild).toBe(true);
    expect(constructionOverrunSubject(project({ projectType: "INFRASTRUCTURE" })).homeBuild).toBe(
      false,
    );
    expect(constructionOverrunSubject(project({ type: "building" })).homeBuild).toBe(false);
    expect(constructionOverrunSubject(project({ foreignContractId: "fc-1" })).homeBuild).toBe(
      false,
    );
  });
});
