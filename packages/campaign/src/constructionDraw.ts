import { checkedMul, roundToInt } from "@bluewave/contracts";
import {
  advanceConstructionMonth,
  LINE_IDS,
  type ConstructionPlan,
  type LineId,
  type PackageProgress,
} from "@bluewave/ship-design";
import type { ConstructionPackage, ConstructionProject } from "./state.js";

export const ACCELERATION_WORK_RATE_MULTIPLIER_BP = 11_000 as const;

const BP = 10_000;

function scaleCapacityUnits(
  capacityUnits: Readonly<Record<string, number>>,
  numerator: number,
  denominator: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(capacityUnits).map(([line, value]) => [
      line,
      Math.floor((value * numerator) / denominator),
    ]),
  );
}

export function accelerateCapacityUnits(
  capacityUnits: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(capacityUnits).map(([line, value]) => [
      line,
      roundToInt(checkedMul(value, ACCELERATION_WORK_RATE_MULTIPLIER_BP) / BP, "floor"),
    ]),
  );
}

export function constructionPlanOf(packages: readonly ConstructionPackage[]): ConstructionPlan {
  const list = packages.map((p) => ({
    id: p["id"],
    kind: p["kind"],
    line: p["line"] as LineId,
    totalWork: p["totalWork"] as number,
    dependsOn: [...p["dependsOn"]],
  }));
  return { packages: list, totalWork: list.reduce((a, p) => a + p.totalWork, 0) };
}

export function packageProgressOf(
  packages: readonly ConstructionPackage[],
): Record<string, number> {
  return Object.fromEntries(packages.map((p) => [p["id"], p["doneWork"] as number]));
}

export function remainingMonthlyCapacityUnits(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
): Record<LineId, number> | undefined {
  const buildTimeBp = project["buildTimeMultiplierBp"];
  const paced =
    capacityUnits === undefined || buildTimeBp === undefined || buildTimeBp === BP
      ? capacityUnits
      : scaleCapacityUnits(capacityUnits, BP, buildTimeBp);
  const effective =
    paced !== undefined && project["status"] === "ACCELERATED"
      ? accelerateCapacityUnits(paced)
      : paced;
  if (effective === undefined) return undefined;
  const usage = project["monthUsage"];
  const used = usage !== undefined && usage["month"] === month ? usage["used"] : undefined;
  return Object.fromEntries(
    LINE_IDS.map((line) => [line, Math.max(0, (effective[line] ?? 0) - Number(used?.[line] ?? 0))]),
  ) as Record<LineId, number>;
}

export function monthlyAbsorbable(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
): number {
  const remaining = Number(project["totalWork"]) - Number(project["completedWork"]);
  if (remaining <= 0) return 0;
  const packages = project["packages"];
  if (packages === undefined) return remaining;
  const usage = project["monthUsage"];
  const sameMonth = usage !== undefined && usage["month"] === month;
  const startDone: PackageProgress = sameMonth
    ? Object.fromEntries(
        Object.entries(usage["startDone"]).map(([id, value]) => [id, value as number]),
      )
    : packageProgressOf(packages);
  const capacity =
    remainingMonthlyCapacityUnits(project, capacityUnits, month) ??
    (Object.fromEntries(LINE_IDS.map((line) => [line, Number.MAX_SAFE_INTEGER])) as Record<
      LineId,
      number
    >);
  const step = advanceConstructionMonth(
    constructionPlanOf(packages),
    packageProgressOf(packages),
    capacity,
    null,
    startDone,
  );
  const applied = Object.values(step.applied).reduce((sum, work) => sum + work, 0);
  return Math.min(remaining, applied);
}
