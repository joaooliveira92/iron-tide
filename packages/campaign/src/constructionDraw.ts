// One answer to "how much work can this project absorb this month?" (ADR-0230 sections 6 and 8). The appropriation
// phase, the economy outlook, the capacity-pressure demand and the dockyard readout all read this, so a projection can
// never contradict the ledger it is about to produce. Pure, integer-only, derived from the project and its throughput.
import { checkedMul, roundToInt } from "@bluewave/contracts";
import {
  advanceConstructionMonth,
  LINE_IDS,
  type ConstructionPlan,
  type LineId,
  type PackageProgress,
} from "@bluewave/ship-design";
import type { ConstructionPackage, ConstructionProject } from "./state.js";

/** `+10%` work rate in a paid accelerated month, basis points (DESIGN-13 section 11.3.2; DESIGN-23 section 8). */
export const ACCELERATION_WORK_RATE_MULTIPLIER_BP = 11_000 as const;

const BP = 10_000;

/** `floor(value x numerator / denominator)` for every line of a capacity record. */
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

/**
 * The paid-month effective capacity of an accelerated project: `floor(baseEffectiveCapacity x 11_000 / 10_000)` per
 * line (DESIGN-13 section 11.3.2; DESIGN-23 section 8). Used only in paid accelerated months.
 */
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

/** The ship-design plan view of a project's stored packages. */
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

/** Work done so far on each package of a project, by package id. */
export function packageProgressOf(
  packages: readonly ConstructionPackage[],
): Record<string, number> {
  return Object.fromEntries(packages.map((p) => [p["id"], p["doneWork"] as number]));
}

/**
 * The capacity still available to a project in `month`, per production line: its compiled throughput paced by the
 * national build-time multiplier (ADR-0090), raised by the accelerated work rate (DESIGN-13 section 11.3.2), less what
 * earlier funding in the same month already used. `undefined` when the project has no throughput record, which the
 * package scheduler treats as unlimited. Pure.
 */
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

/**
 * The most work this project can absorb in `month`, whatever the treasury offers: its remaining work, scheduled through
 * its packages at the month's effective throughput. Dependencies are judged against the progress at the month's start,
 * so funding the same month in several steps cannot start a dependent early (ADR-0077); capacity already used this month
 * is not offered twice.
 *
 * A single-figure project (no packages) has no package schedule, so capacity paces nothing: the executor's single-figure
 * path applies its remaining work, and so does this answer. Pure and deterministic.
 */
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
