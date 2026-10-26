import {
  isConstructionComplete,
  isPackageComplete,
  LINE_IDS,
  PACKAGE_ORDER,
  type LineId,
  type ConstructionPlan,
  type PackageProgress,
} from "./construction.js";
import type { BuildProgress } from "./revision.js";
import { designInvariant } from "./errors.js";

const doneOn = (progress: PackageProgress, id: string) => progress[id] ?? 0;

export function buildProgressOf(plan: ConstructionPlan, progress: PackageProgress): BuildProgress {
  const total = (id: string) => plan.packages.find((p) => p.id === id)?.totalWork ?? 0;
  const hull = plan.packages.find((p) => p.kind === "HULL");
  const kindDone = (kind: ConstructionPlan["packages"][number]["kind"]) =>
    plan.packages.filter((p) => p.kind === kind).reduce((a, p) => a + doneOn(progress, p.id), 0);
  const launch = plan.packages.find((p) => p.kind === "LAUNCH");
  return {
    hullDoneWork: hull ? doneOn(progress, hull.id) : 0,
    hullTotalWork: hull ? total(hull.id) : 0,
    armourStarted: kindDone("ARMOUR") > 0,
    machineryStarted: kindDone("MACHINERY") > 0,
    launched: launch ? isPackageComplete(plan, progress, launch.id) : false,
    affectedDoneWork: plan.packages.reduce((a, p) => a + doneOn(progress, p.id), 0),
  };
}

export function progressFromSingleFigure(
  plan: ConstructionPlan,
  completedWork: number,
  totalWork: number,
): PackageProgress {
  const progress: Record<string, number> = Object.fromEntries(plan.packages.map((p) => [p.id, 0]));
  if (totalWork <= 0 || completedWork <= 0) return progress;
  const share = Math.min(1, completedWork / totalWork);
  let pool =
    completedWork >= totalWork
      ? plan.totalWork
      : Number((BigInt(plan.totalWork) * BigInt(Math.floor(share * 1_000_000))) / 1_000_000n);
  const ordered = [...plan.packages].sort(
    (a, b) =>
      PACKAGE_ORDER.indexOf(a.kind) - PACKAGE_ORDER.indexOf(b.kind) || (a.id < b.id ? -1 : 1),
  );
  for (const p of ordered) {
    const take = Math.min(pool, p.totalWork);
    progress[p.id] = take;
    pool -= take;
  }
  return progress;
}

export function totalDone(plan: ConstructionPlan, progress: PackageProgress): number {
  return plan.packages.reduce((a, p) => a + Math.min(p.totalWork, doneOn(progress, p.id)), 0);
}

export { isConstructionComplete };

export function scalePlanToUnits(plan: ConstructionPlan, totalUnits: number): ConstructionPlan {
  if (!Number.isSafeInteger(totalUnits) || totalUnits < 0)
    throw designInvariant(`totalUnits must be a non-negative integer, got ${totalUnits}`);
  if (plan.totalWork <= 0) throw designInvariant("a plan with no work cannot be scaled");
  const exact = plan.packages.map((p) => {
    const product = BigInt(p.totalWork) * BigInt(totalUnits);
    return {
      p,
      floor: Number(product / BigInt(plan.totalWork)),
      rem: product % BigInt(plan.totalWork),
    };
  });
  let left = totalUnits - exact.reduce((a, e) => a + e.floor, 0);
  const byRemainder = [...exact].sort(
    (a, b) => (a.rem === b.rem ? 0 : a.rem > b.rem ? -1 : 1) || (a.p.id < b.p.id ? -1 : 1),
  );
  const extra = new Map<string, number>();
  for (const e of byRemainder) {
    if (left <= 0) break;
    extra.set(e.p.id, 1);
    left--;
  }
  const packages = exact.map((e) => ({ ...e.p, totalWork: e.floor + (extra.get(e.p.id) ?? 0) }));
  return { packages, totalWork: totalUnits };
}

export function capacityInUnits(
  capacity: Readonly<Record<LineId, number>>,
  plan: ConstructionPlan,
  totalUnits: number,
): Record<LineId, number> {
  if (plan.totalWork <= 0) throw designInvariant("a plan with no work has no scale");
  return Object.fromEntries(
    LINE_IDS.map((line) => {
      const micro = capacity[line];
      if (!(micro > 0)) return [line, 0];
      const scaled = Number(
        (BigInt(Math.floor(micro)) * BigInt(totalUnits)) / BigInt(plan.totalWork),
      );
      return [line, Math.max(1, scaled)];
    }),
  ) as Record<LineId, number>;
}
