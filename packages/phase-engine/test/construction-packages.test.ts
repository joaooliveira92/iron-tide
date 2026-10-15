import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionPackage,
  ConstructionProject,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { constructionPackageProblems } from "../src/constructionPackages.js";
import { cloneSnapshot } from "../src/snapshotClone.js";
import { runClosingValidationPhase } from "../src/validationPhases.js";

const pkg = (
  id: string,
  total: number,
  done: number,
  dependsOn: string[] = [],
  kind: ConstructionPackage["kind"] = "HULL",
): ConstructionPackage => ({
  id,
  kind,
  line: "slipway",
  totalWork: SafeInt(total),
  doneWork: SafeInt(done),
  dependsOn,
});
const project = (
  packages: ConstructionPackage[] | undefined,
  over: Partial<ConstructionProject> = {},
): ConstructionProject => {
  const total = (packages ?? []).reduce((a, p) => a + (p.totalWork as number), 0);
  const done = (packages ?? []).reduce((a, p) => a + (p.doneWork as number), 0);
  return {
    id: "project-1",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "t",
    designVersionId: "d",
    totalWork: SafeInt(packages === undefined ? 100 : total),
    completedWork: SafeInt(packages === undefined ? 40 : done),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: "1880-01",
    ...(packages === undefined ? {} : { packages }),
    ...over,
  };
};

describe("constructionPackageProblems", () => {
  it("has nothing to say about a project without packages (the single-figure model)", () => {
    expect(constructionPackageProblems(project(undefined))).toEqual([]);
  });
  it("accepts consistent packages, including an empty list and a finished project", () => {
    expect(
      constructionPackageProblems(project([pkg("hull", 100, 60), pkg("launch", 20, 0, ["hull"])])),
    ).toEqual([]);
    expect(constructionPackageProblems(project([pkg("hull", 100, 100)]))).toEqual([]);
    expect(constructionPackageProblems(project([]))).toEqual([]);
  });
  it("reports each kind of inconsistency", () => {
    const text = (p: ConstructionProject) => constructionPackageProblems(p).join("\n");
    expect(text(project([pkg("a", 10, 0), pkg("a", 10, 0)]))).toMatch(/package a is listed twice/);
    expect(text(project([pkg("a", 10, 0, ["ghost"])]))).toMatch(/depends on unknown package ghost/);
    expect(
      text(project([pkg("a", 10, 11)], { totalWork: SafeInt(10), completedWork: SafeInt(11) })),
    ).toMatch(/more work done \(11\) than total \(10\)/);
    expect(text(project([pkg("a", 10, 0)], { totalWork: SafeInt(99) }))).toMatch(
      /package totals \(10\) differ from the project's totalWork \(99\)/,
    );
    expect(text(project([pkg("a", 10, 4)], { completedWork: SafeInt(5) }))).toMatch(
      /work done \(4\) differs from the project's completedWork \(5\)/,
    );
  });
});

describe("closing validation of package progress", () => {
  const snapshotWith = (p: ConstructionProject) =>
    ({
      nations: new Map([["n1", { treasury: SafeInt(0), fleets: [], constructionProjects: [p] }]]),
    }) as unknown as CampaignSnapshot;
  it("passes consistent projects and flags inconsistent ones with a stable code", () => {
    const ok = new DiagnosticCollector();
    expect(runClosingValidationPhase(snapshotWith(project([pkg("hull", 10, 5)])), ok)).toBe(true);
    const bad = new DiagnosticCollector();
    expect(
      runClosingValidationPhase(
        snapshotWith(project([pkg("hull", 10, 5)], { completedWork: SafeInt(9) })),
        bad,
      ),
    ).toBe(false);
    expect(bad.errors.map((e) => e.code)).toEqual(["CONSTRUCTION_PACKAGE_INCONSISTENT"]);
  });
  it("leaves legacy single-figure projects unchanged", () => {
    const c = new DiagnosticCollector();
    expect(runClosingValidationPhase(snapshotWith(project(undefined)), c)).toBe(true);
  });
});

describe("snapshot clone of package progress", () => {
  it("deep-copies packages and their dependencies, and keeps absent fields absent", () => {
    const withPackages = project([pkg("hull", 10, 5), pkg("launch", 4, 0, ["hull"])], {
      yardId: "yard_small",
    });
    const legacy = project(undefined);
    const snap = {
      nations: new Map([["n1", { constructionProjects: [withPackages, legacy] }]]),
    } as unknown as CampaignSnapshot;
    const copy = cloneSnapshot(snap);
    const [a, b] = copy["nations"].get("n1")!["constructionProjects"] as ConstructionProject[];
    expect(a).toEqual(withPackages);
    expect(a!["packages"]).not.toBe(withPackages["packages"]);
    expect(a!["packages"]![1]!["dependsOn"]).not.toBe(withPackages["packages"]![1]!["dependsOn"]);
    expect("packages" in b!).toBe(false);
    expect("yardId" in b!).toBe(false);
  });
});

describe("snapshot clone of a design version's construction plan", () => {
  it("deep-copies the plan, its packages and its capacity", () => {
    const design = {
      designVersionId: "d1",
      constructionPlan: {
        yardId: "yard_small",
        packages: [
          { id: "hull", kind: "HULL", line: "slipway", totalWork: SafeInt(10), dependsOn: [] },
          {
            id: "launch",
            kind: "LAUNCH",
            line: "slipway",
            totalWork: SafeInt(4),
            dependsOn: ["hull"],
          },
        ],
        capacityUnits: { slipway: SafeInt(3) },
      },
    } as unknown as CompiledDesignVersion;
    const snap = { designs: new Map([["d1", design]]) } as unknown as CampaignSnapshot;
    const copy = cloneSnapshot(snap).designs.get("d1")!;
    expect(copy.constructionPlan).toEqual(design.constructionPlan);
    expect(copy.constructionPlan).not.toBe(design.constructionPlan);
    expect(copy.constructionPlan!.packages[1]!.dependsOn).not.toBe(
      design.constructionPlan!.packages[1]!.dependsOn,
    );
    expect(copy.constructionPlan!.capacityUnits).not.toBe(design.constructionPlan!.capacityUnits);
  });
});
