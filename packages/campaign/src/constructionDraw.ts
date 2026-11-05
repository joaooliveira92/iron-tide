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

export const CONSTRUCTION_LINE_IDS = LINE_IDS;

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
  const buildTimeBp =
    project["buildMonths"] === undefined ? project["buildTimeMultiplierBp"] : undefined;
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

const MONTH_ID = /^(\d{4})-(0[1-9]|1[0-2])$/;

function monthIndex(month: string): number | null {
  const match = MONTH_ID.exec(month);
  return match === null ? null : Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function monthsSinceStart(project: ConstructionProject, month: string): number {
  const start = monthIndex(project["startedAt"]);
  const now = monthIndex(month);
  return start === null || now === null ? 0 : Math.max(0, now - start);
}

function isPaced(project: ConstructionProject): project is ConstructionProject & {
  readonly buildMonths: number;
} {
  return (
    project["buildMonths"] !== undefined &&
    project["packages"] !== undefined &&
    project["status"] !== "ACCELERATED"
  );
}

function cumulativeAllowance(totalWork: number, buildMonths: number, elapsed: number): number {
  const months = Math.min(buildMonths, elapsed + 1);
  return Math.floor((totalWork * months) / buildMonths);
}

export function paceRoomUnits(project: ConstructionProject, month: string): number {
  if (!isPaced(project)) return Number.MAX_SAFE_INTEGER;
  const allowed = cumulativeAllowance(
    Number(project["totalWork"]),
    project["buildMonths"],
    monthsSinceStart(project, month),
  );
  return Math.max(0, allowed - Number(project["completedWork"]));
}

export interface MonthlyAbsorbableDetail {
  readonly amount: number;
  readonly remainingWork: number;
  readonly appliedByLine: Readonly<Record<LineId, number>>;
  readonly limitedLines: readonly LineId[];
}

function emptyLineWork(): Record<LineId, number> {
  return Object.fromEntries(LINE_IDS.map((line) => [line, 0])) as Record<LineId, number>;
}

export function monthlyAbsorbableDetail(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
): MonthlyAbsorbableDetail {
  const remaining = Number(project["totalWork"]) - Number(project["completedWork"]);
  if (remaining <= 0) {
    return {
      amount: 0,
      remainingWork: 0,
      appliedByLine: emptyLineWork(),
      limitedLines: [],
    };
  }
  const packages = project["packages"];
  if (packages === undefined) {
    return {
      amount: remaining,
      remainingWork: remaining,
      appliedByLine: emptyLineWork(),
      limitedLines: [],
    };
  }
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
  const room = paceRoomUnits(project, month);
  const step = advanceConstructionMonth(
    constructionPlanOf(packages),
    packageProgressOf(packages),
    capacity,
    room === Number.MAX_SAFE_INTEGER ? null : room,
    startDone,
  );
  const applied = Object.values(step.applied).reduce((sum, work) => sum + work, 0);
  const lineById = new Map(packages.map((p) => [p.id, p.line as LineId]));
  const appliedByLine = emptyLineWork();
  for (const [id, work] of Object.entries(step.applied)) {
    const line = lineById.get(id);
    if (line !== undefined) appliedByLine[line] += work;
  }
  return {
    amount: Math.min(remaining, applied),
    remainingWork: remaining,
    appliedByLine,
    limitedLines: [...step.limitedLines],
  };
}

export function monthlyAbsorbable(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
): number {
  return monthlyAbsorbableDetail(project, capacityUnits, month).amount;
}

export function projectMonthsToComplete(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
  maxMonths = 1_200,
): number {
  const packages = project["packages"];
  if (packages === undefined) return 0;
  const plan = constructionPlanOf(packages);
  const total = Number(project["totalWork"]);
  let progress = packageProgressOf(packages);
  let done = Number(project["completedWork"]);
  const first = remainingMonthlyCapacityUnits(project, capacityUnits, month);
  const full = remainingMonthlyCapacityUnits(
    { ...project, monthUsage: undefined } as ConstructionProject,
    capacityUnits,
    month,
  );
  const usage = project["monthUsage"];
  let startDone: PackageProgress =
    usage !== undefined && usage["month"] === month
      ? Object.fromEntries(
          Object.entries(usage["startDone"]).map(([id, value]) => [id, value as number]),
        )
      : progress;
  for (let months = 1; months <= maxMonths; months += 1) {
    if (done >= total) return months - 1;
    const capacity =
      (months === 1 ? first : full) ??
      (Object.fromEntries(LINE_IDS.map((line) => [line, Number.MAX_SAFE_INTEGER])) as Record<
        LineId,
        number
      >);
    const room = isPaced(project)
      ? Math.max(
          0,
          cumulativeAllowance(
            total,
            project["buildMonths"],
            monthsSinceStart(project, month) + months - 1,
          ) - done,
        )
      : null;
    const step = advanceConstructionMonth(plan, progress, capacity, room, startDone);
    const applied = Object.values(step.applied).reduce((sum, work) => sum + work, 0);
    progress = step.progress;
    startDone = progress;
    done += applied;
    if (done >= total) return months;
  }
  return maxMonths;
}
