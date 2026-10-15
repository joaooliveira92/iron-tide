import type { ConstructionPackage, ConstructionProject } from "@bluewave/campaign";
import { transitionConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  advanceConstructionMonth,
  LINE_IDS,
  type ConstructionPlan,
  type LineId,
  type PackageProgress,
} from "@bluewave/ship-design";
import { accelerateCapacityUnits, constructionWorkStatus } from "./constructionAcceleration.js";

/** The ship-design plan view of a project's stored packages. */
export function planOf(packages: readonly ConstructionPackage[]): ConstructionPlan {
  const list = packages.map((p) => ({
    id: p["id"],
    kind: p["kind"],
    line: p["line"] as LineId,
    totalWork: p["totalWork"] as number,
    dependsOn: [...p["dependsOn"]],
  }));
  return { packages: list, totalWork: list.reduce((a, p) => a + p.totalWork, 0) };
}

export const doneOf = (packages: readonly ConstructionPackage[]): Record<string, number> =>
  Object.fromEntries(packages.map((p) => [p["id"], p["doneWork"] as number]));

export interface FundingResult {
  readonly project: ConstructionProject;
  /** Work actually applied (treasury units), at most the funds offered; 0 when capacity or dependencies leave nothing to do. */
  readonly applied: number;
}

/**
 * Applies `funds` (treasury units) to a project that has work packages (ADR-0077): work goes to packages whose dependencies
 * were complete at the start of the month, limited by the yard's remaining capacity per line this month
 * (`capacityUnits` minus what earlier funding this month used; undefined means unlimited) and by each package's remaining
 * work. `completedWork` becomes the sum of the packages' done work and `paidWork` grows by what was applied, so money that
 * could not be used is not spent. Pure and deterministic; the caller charges the treasury `applied`.
 *
 * A project without packages is returned unchanged with `applied` 0: the caller keeps the single-figure arithmetic.
 */
export function fundConstructionProject(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  funds: number,
  month: string,
): FundingResult {
  const packages = project["packages"];
  if (packages === undefined) return { project, applied: 0 };
  // National build-time (ADR-0090): a nation that builds faster does more work per month for the same yard capacity.
  // Persisted on the project at order time, so a later profile change never re-paces an existing project.
  const buildTimeBp = project["buildTimeMultiplierBp"];
  const baseCapacity =
    capacityUnits === undefined || buildTimeBp === undefined || buildTimeBp === 10_000
      ? capacityUnits
      : (Object.fromEntries(
          Object.entries(capacityUnits).map(([line, v]) => [
            line,
            Math.floor((v * 10_000) / buildTimeBp),
          ]),
        ) as Readonly<Record<string, number>>);
  // DESIGN-13 section 11.3.2: a paid accelerated month uses `floor(baseEffectiveCapacity * 11_000 / 10_000)`.
  const effectiveCapacity =
    baseCapacity !== undefined && project["status"] === "ACCELERATED"
      ? accelerateCapacityUnits(baseCapacity)
      : baseCapacity;
  const plan = planOf(packages);
  const usage = project["monthUsage"];
  const sameMonth = usage !== undefined && usage["month"] === month;
  const startDone: PackageProgress = sameMonth
    ? Object.fromEntries(Object.entries(usage["startDone"]).map(([id, v]) => [id, v as number]))
    : doneOf(packages);
  const used: Record<string, number> = sameMonth
    ? Object.fromEntries(Object.entries(usage["used"]).map(([line, v]) => [line, v as number]))
    : {};
  const remainingCapacity = Object.fromEntries(
    LINE_IDS.map((line) => [
      line,
      effectiveCapacity === undefined
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, (effectiveCapacity[line] ?? 0) - (used[line] ?? 0)),
    ]),
  ) as Record<LineId, number>;
  const step = advanceConstructionMonth(
    plan,
    doneOf(packages),
    remainingCapacity,
    Math.max(0, Math.floor(funds)),
    startDone,
  );
  const applied = Object.values(step.applied).reduce((a, b) => a + b, 0);
  const lineOf = new Map(plan.packages.map((p) => [p.id, p.line]));
  const usedAfter: Record<string, number> = { ...used };
  for (const [id, work] of Object.entries(step.applied))
    usedAfter[lineOf.get(id)!] = (usedAfter[lineOf.get(id)!] ?? 0) + work;
  const nextPackages = packages.map((p) => ({
    ...p,
    doneWork: SafeInt(step.progress[p["id"]] ?? (p["doneWork"] as number)),
    dependsOn: [...p["dependsOn"]],
  }));
  const completed = nextPackages.reduce((a, p) => a + (p["doneWork"] as number), 0);
  const advanced =
    applied > 0
      ? transitionConstructionProject(project, constructionWorkStatus(project["status"]))
      : project;
  return {
    applied,
    project: {
      ...advanced,
      packages: nextPackages,
      completedWork: SafeInt(completed),
      paidWork: SafeInt.add(project["paidWork"], SafeInt(applied)),
      monthUsage: {
        month,
        used: Object.fromEntries(Object.entries(usedAfter).map(([l, v]) => [l, SafeInt(v)])),
        startDone: Object.fromEntries(Object.entries(startDone).map(([id, v]) => [id, SafeInt(v)])),
      },
    },
  };
}
