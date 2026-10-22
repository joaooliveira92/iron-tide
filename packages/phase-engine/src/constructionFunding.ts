import type { ConstructionProject } from "@bluewave/campaign";
import {
  constructionPlanOf,
  monthlyAbsorbable,
  packageProgressOf,
  remainingMonthlyCapacityUnits,
  transitionConstructionProject,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  advanceConstructionMonth,
  LINE_IDS,
  type LineId,
  type PackageProgress,
} from "@bluewave/ship-design";
import { constructionWorkStatus } from "./constructionAcceleration.js";

export interface FundingResult {
  readonly project: ConstructionProject;
  readonly applied: number;
}

export function fundConstructionProject(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  funds: number,
  month: string,
): FundingResult {
  const packages = project["packages"];
  if (packages === undefined) return { project, applied: 0 };
  const plan = constructionPlanOf(packages);
  const usage = project["monthUsage"];
  const sameMonth = usage !== undefined && usage["month"] === month;
  const startDone: PackageProgress = sameMonth
    ? Object.fromEntries(Object.entries(usage["startDone"]).map(([id, v]) => [id, v as number]))
    : packageProgressOf(packages);
  const used: Record<string, number> = sameMonth
    ? Object.fromEntries(Object.entries(usage["used"]).map(([line, v]) => [line, v as number]))
    : {};
  const remainingCapacity =
    remainingMonthlyCapacityUnits(project, capacityUnits, month) ??
    (Object.fromEntries(LINE_IDS.map((line) => [line, Number.MAX_SAFE_INTEGER])) as Record<
      LineId,
      number
    >);
  const draw = Math.min(
    Math.max(0, Math.floor(funds)),
    monthlyAbsorbable(project, capacityUnits, month),
  );
  const step = advanceConstructionMonth(
    plan,
    packageProgressOf(packages),
    remainingCapacity,
    draw,
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
