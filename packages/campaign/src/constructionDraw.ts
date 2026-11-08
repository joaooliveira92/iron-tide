import {
  acceleratedWorkRate,
  advanceConstructionMonth,
  LINE_IDS,
  type AccelerationTerms,
  type ConstructionPlan,
  type LineId,
  type PackageProgress,
} from "@bluewave/ship-design";
import type { ConstructionPackage, ConstructionProject } from "./state.js";

export type { AccelerationTerms };

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
  terms: AccelerationTerms,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(capacityUnits).map(([line, value]) => [line, acceleratedWorkRate(value, terms)]),
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

export function accelerateCapacityUnitsAt(
  capacityUnits: Readonly<Record<string, number>>,
  terms: AccelerationTerms,
  monthsSinceAnchor: number,
): Record<string, number> {
  const through = (units: number, months: number): number =>
    Math.floor((units * terms.workMultiplierBp * months) / terms.timeBp);
  return Object.fromEntries(
    Object.entries(capacityUnits).map(([line, value]) => [
      line,
      through(value, monthsSinceAnchor + 1) - through(value, monthsSinceAnchor),
    ]),
  );
}

function acceleratedCapacityUnits(
  project: ConstructionProject,
  paced: Readonly<Record<string, number>>,
  month: string,
  monthsAhead: number,
  terms: AccelerationTerms,
): Record<string, number> {
  const from = monthIndex(project["acceleratedFromMonth"] ?? "");
  const now = monthIndex(month);
  if (from === null || now === null) return accelerateCapacityUnits(paced, terms);
  return accelerateCapacityUnitsAt(paced, terms, Math.max(0, now - from) + monthsAhead);
}

export function remainingMonthlyCapacityUnits(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
  terms?: AccelerationTerms,
  monthsAhead = 0,
): Record<LineId, number> | undefined {
  const buildTimeBp =
    project["buildMonths"] === undefined ? project["buildTimeMultiplierBp"] : undefined;
  const paced =
    capacityUnits === undefined || buildTimeBp === undefined || buildTimeBp === BP
      ? capacityUnits
      : scaleCapacityUnits(capacityUnits, BP, buildTimeBp);
  const effective =
    paced !== undefined && terms !== undefined && project["status"] === "ACCELERATED"
      ? acceleratedCapacityUnits(project, paced, month, monthsAhead, terms)
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
  return project["buildMonths"] !== undefined && project["packages"] !== undefined;
}

function cumulativeAllowance(totalWork: number, buildMonths: number, elapsed: number): number {
  const months = Math.min(buildMonths, elapsed + 1);
  return Math.floor((totalWork * months) / buildMonths);
}

function acceleratedAllowance(
  project: ConstructionProject & { readonly buildMonths: number },
  fromMonth: string,
  fromWork: number,
  month: string,
  monthsAhead: number,
  terms: AccelerationTerms,
): number {
  const from = monthIndex(fromMonth);
  const now = monthIndex(month);
  if (from === null || now === null)
    return cumulativeAllowance(
      Number(project["totalWork"]),
      project["buildMonths"],
      monthsSinceStart(project, month) + monthsAhead,
    );
  const remainingMonths = Math.max(
    1,
    project["buildMonths"] - monthsSinceStart(project, fromMonth),
  );
  const compressed = Math.max(1, Math.round((remainingMonths * terms.timeBp) / BP));
  const elapsed = Math.max(0, now - from) + monthsAhead;
  const months = Math.min(compressed, elapsed + 1);
  const remainingWork = Math.max(0, Number(project["totalWork"]) - fromWork);
  return fromWork + Math.floor((remainingWork * months) / compressed);
}

function paceAllowance(
  project: ConstructionProject & { readonly buildMonths: number },
  month: string,
  monthsAhead: number,
  terms: AccelerationTerms | undefined,
): number {
  const fromMonth = project["acceleratedFromMonth"];
  const fromWork = project["acceleratedFromWork"];
  if (
    project["status"] === "ACCELERATED" &&
    terms !== undefined &&
    fromMonth !== undefined &&
    fromWork !== undefined
  )
    return acceleratedAllowance(project, fromMonth, Number(fromWork), month, monthsAhead, terms);
  return cumulativeAllowance(
    Number(project["totalWork"]),
    project["buildMonths"],
    monthsSinceStart(project, month) + monthsAhead,
  );
}

export function paceRoomUnits(
  project: ConstructionProject,
  month: string,
  terms?: AccelerationTerms,
): number {
  if (!isPaced(project)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, paceAllowance(project, month, 0, terms) - Number(project["completedWork"]));
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
  terms?: AccelerationTerms,
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
    remainingMonthlyCapacityUnits(project, capacityUnits, month, terms) ??
    (Object.fromEntries(LINE_IDS.map((line) => [line, Number.MAX_SAFE_INTEGER])) as Record<
      LineId,
      number
    >);
  const room = paceRoomUnits(project, month, terms);
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
  terms?: AccelerationTerms,
): number {
  return monthlyAbsorbableDetail(project, capacityUnits, month, terms).amount;
}

export function projectMonthsToComplete(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
  maxMonths = 1_200,
  terms?: AccelerationTerms,
): number {
  const packages = project["packages"];
  if (packages === undefined) return 0;
  const plan = constructionPlanOf(packages);
  const total = Number(project["totalWork"]);
  let progress = packageProgressOf(packages);
  let done = Number(project["completedWork"]);
  const first = remainingMonthlyCapacityUnits(project, capacityUnits, month, terms);
  const unused = { ...project, monthUsage: undefined } as ConstructionProject;
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
      (months === 1
        ? first
        : remainingMonthlyCapacityUnits(unused, capacityUnits, month, terms, months - 1)) ??
      (Object.fromEntries(LINE_IDS.map((line) => [line, Number.MAX_SAFE_INTEGER])) as Record<
        LineId,
        number
      >);
    const room = isPaced(project)
      ? Math.max(0, paceAllowance(project, month, months - 1, terms) - done)
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
