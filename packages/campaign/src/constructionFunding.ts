import { SafeInt } from "@bluewave/contracts";
import {
  advanceConstructionMonth,
  LINE_IDS,
  type LineId,
  type PackageProgress,
} from "@bluewave/ship-design";
import {
  constructionPlanOf,
  monthlyAbsorbable,
  packageProgressOf,
  remainingMonthlyCapacityUnits,
} from "./constructionDraw.js";
import { transitionConstructionProject } from "./constructionStatus.js";
import type { CampaignSnapshot, ConstructionProject } from "./state.js";

export interface FundingResult {
  readonly project: ConstructionProject;
  readonly applied: number;
}

export function constructionWorkStatus(
  status: ConstructionProject["status"],
): "ACTIVE" | "ACCELERATED" {
  return status === "ACCELERATED" ? "ACCELERATED" : "ACTIVE";
}

export function splitLargestRemainder(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const totalBig = BigInt(total);
  const weightSumBig = BigInt(weightSum);
  const base: number[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  let assigned = 0n;
  for (let index = 0; index < weights.length; index += 1) {
    const numerator = totalBig * BigInt(weights[index]!);
    const quotient = numerator / weightSumBig;
    base.push(Number(quotient));
    remainders.push({ index, remainder: numerator % weightSumBig });
    assigned += quotient;
  }
  const leftover = Number(totalBig - assigned);
  remainders.sort((a, b) =>
    b.remainder === a.remainder ? a.index - b.index : b.remainder > a.remainder ? 1 : -1,
  );
  for (let i = 0; i < leftover; i += 1) {
    const index = remainders[i]!.index;
    base[index] = base[index]! + 1;
  }
  return base;
}

export function isUnpacedNewConstruction(project: ConstructionProject): boolean {
  return (
    project["type"] === "ship" &&
    project["projectType"] === "NEW_CONSTRUCTION" &&
    project["packages"] === undefined &&
    project["foreignContractId"] === undefined
  );
}

export function capacityOf(
  designs: CampaignSnapshot["designs"],
  project: ConstructionProject,
): Record<string, number> | undefined {
  const capacity =
    project["capacityUnits"] ??
    designs.get(project["designVersionId"])?.constructionPlan?.capacityUnits;
  return capacity === undefined
    ? undefined
    : Object.fromEntries(Object.entries(capacity).map(([line, v]) => [line, v as number]));
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

function applyLeftoverFunding(
  projects: ConstructionProject[],
  remainingFunds: SafeInt,
  designs: CampaignSnapshot["designs"],
  campaignMonth: string,
  foreignSkip: ReadonlySet<string> | undefined,
): { projects: ConstructionProject[]; delta: SafeInt } {
  if ((remainingFunds as number) <= 0) {
    return { projects, delta: SafeInt.ZERO };
  }
  const skipped = (p: ConstructionProject): boolean => foreignSkip?.has(p["id"]) ?? false;
  for (const candidate of projects) {
    if (
      candidate["packages"] === undefined ||
      candidate["status"] === "COMPLETED" ||
      candidate["status"] === "CANCELLED"
    )
      continue;
    if (candidate["status"] === "HALTED" || candidate["status"] === "DELAYED") continue;
    if (skipped(candidate)) continue;
    if ((candidate["completedWork"] as number) >= (candidate["totalWork"] as number)) continue;
    const funded = fundConstructionProject(
      candidate,
      capacityOf(designs, candidate),
      remainingFunds as number,
      campaignMonth,
    );
    if (funded.applied <= 0) continue;
    return {
      projects: projects.map((p) => (p["id"] === candidate["id"] ? funded.project : p)),
      delta: SafeInt(funded.applied),
    };
  }
  const firstIncomplete = projects.find(
    (p) =>
      p["packages"] === undefined &&
      !isUnpacedNewConstruction(p) &&
      (p["completedWork"] as number) < (p["totalWork"] as number) &&
      p["status"] !== "COMPLETED" &&
      p["status"] !== "CANCELLED" &&
      p["status"] !== "HALTED" &&
      p["status"] !== "DELAYED" &&
      !skipped(p),
  );
  if (!firstIncomplete) return { projects, delta: SafeInt.ZERO };

  const remainingWork = SafeInt.sub(firstIncomplete["totalWork"], firstIncomplete["completedWork"]);
  const extra = remainingFunds > remainingWork ? remainingWork : remainingFunds;
  if ((extra as number) <= 0) return { projects, delta: SafeInt.ZERO };

  return {
    projects: projects.map((p) =>
      p["id"] === firstIncomplete["id"]
        ? {
            ...transitionConstructionProject(p, constructionWorkStatus(p["status"])),
            completedWork: SafeInt.add(p["completedWork"], extra),
            paidWork: SafeInt.add(p["paidWork"], extra),
          }
        : p,
    ),
    delta: extra,
  };
}

export interface ConstructionFundingAllocation {
  readonly projects: ConstructionProject[];
  readonly delta: SafeInt;
  readonly requested: number;
  readonly draws: ReadonlyMap<string, number>;
}

export function allocateConstructionFunds(input: {
  readonly projects: readonly ConstructionProject[];
  readonly available: SafeInt;
  readonly designs: CampaignSnapshot["designs"];
  readonly month: string;
  readonly foreignSkip?: ReadonlySet<string> | undefined;
}): ConstructionFundingAllocation {
  const { available, designs, month, foreignSkip } = input;
  let updatedProjects = [...input.projects];
  let totalDelta = SafeInt.ZERO;
  const fundable =
    (available as number) > 0
      ? updatedProjects.filter(
          (p) =>
            (p["completedWork"] as number) < (p["totalWork"] as number) &&
            p["status"] !== "COMPLETED" &&
            p["status"] !== "CANCELLED" &&
            p["status"] !== "HALTED" &&
            p["status"] !== "DELAYED" &&
            !isUnpacedNewConstruction(p) &&
            !(foreignSkip?.has(p["id"]) ?? false),
        )
      : [];
  const requested = fundable.reduce((sum: number, p) => {
    const remaining = (p["totalWork"] as number) - (p["completedWork"] as number);
    if (p["packages"] === undefined) return sum + remaining;
    const absorbable = fundConstructionProject(
      p,
      capacityOf(designs, p),
      Number.MAX_SAFE_INTEGER,
      month,
    ).applied;
    return sum + Math.min(remaining, absorbable);
  }, 0);
  if (fundable.length > 0) {
    const totalRemainingWork = fundable.reduce(
      (sum: SafeInt, p) => SafeInt.add(sum, SafeInt.sub(p["totalWork"], p["completedWork"])),
      SafeInt.ZERO,
    );
    if ((totalRemainingWork as number) > 0) {
      let remainingFunds = available;
      const remainingWorks = fundable.map((p) =>
        Number(SafeInt.sub(p["totalWork"], p["completedWork"])),
      );
      const allocations = splitLargestRemainder(available as number, remainingWorks);

      for (let fi = 0; fi < fundable.length; fi += 1) {
        const project = fundable[fi]!;
        if ((remainingFunds as number) <= 0) break;

        const remainingWork = SafeInt.sub(project["totalWork"], project["completedWork"]);
        const alloc = SafeInt(allocations[fi]!);
        const clampedAlloc = alloc > remainingWork ? remainingWork : alloc;
        if ((clampedAlloc as number) <= 0) continue;

        if (project["packages"] !== undefined) {
          const funded = fundConstructionProject(
            project,
            capacityOf(designs, project),
            clampedAlloc as number,
            month,
          );
          if (funded.applied <= 0) continue;
          const applied = SafeInt(funded.applied);
          totalDelta = SafeInt.add(totalDelta, applied);
          remainingFunds = SafeInt.sub(remainingFunds, applied);
          updatedProjects = updatedProjects.map((p) =>
            p["id"] === project["id"] ? funded.project : p,
          );
          continue;
        }

        totalDelta = SafeInt.add(totalDelta, clampedAlloc);
        remainingFunds = SafeInt.sub(remainingFunds, clampedAlloc);

        updatedProjects = updatedProjects.map((p) =>
          p["id"] === project["id"]
            ? {
                ...transitionConstructionProject(p, constructionWorkStatus(p["status"])),
                completedWork: SafeInt.add(p["completedWork"], clampedAlloc),
                paidWork: SafeInt.add(p["paidWork"], clampedAlloc),
              }
            : p,
        );
      }

      const leftover = applyLeftoverFunding(
        updatedProjects,
        remainingFunds,
        designs,
        month,
        foreignSkip,
      );
      updatedProjects = leftover.projects;
      totalDelta = SafeInt.add(totalDelta, leftover.delta);
    }
  }
  const before = new Map(input.projects.map((p) => [p["id"], Number(p["paidWork"])]));
  const draws = new Map(
    updatedProjects.map((p) => [p["id"], Number(p["paidWork"]) - (before.get(p["id"]) ?? 0)]),
  );
  return { projects: updatedProjects, delta: totalDelta, requested, draws };
}
