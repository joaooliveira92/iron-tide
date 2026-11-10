import type { ConstructionPackage, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";

import type { ConstructionEventSubject } from "./constructionEvents.js";

const HOME_PROJECT_TYPES: ReadonlySet<ConstructionProject["projectType"]> = new Set([
  "NEW_CONSTRUCTION",
  "REBUILD",
]);

export function constructionOverrunTotal(project: ConstructionProject): number {
  return (project.overruns ?? []).reduce((sum, o) => sum + Number(o.amount), 0);
}

export function constructionOverrunSubject(project: ConstructionProject): ConstructionEventSubject {
  const overrunWork = constructionOverrunTotal(project);
  return {
    id: project.id,
    status: project.status,
    homeBuild:
      project.type === "ship" &&
      HOME_PROJECT_TYPES.has(project.projectType) &&
      project.foreignContractId === undefined &&
      project.foreignBuilderNationId === undefined,
    remainingWork: Math.max(0, Number(project.totalWork) - Number(project.completedWork)),
    originalWork: Number(project.totalWork) - overrunWork,
    overrunWork,
  };
}

function spreadOverUnfinished(
  packages: readonly ConstructionPackage[],
  amount: number,
): ConstructionPackage[] {
  const unfinished = packages
    .map((p) => ({ p, remaining: Math.max(0, Number(p.totalWork) - Number(p.doneWork)) }))
    .filter((e) => e.remaining > 0);
  const remainingTotal = unfinished.reduce((sum, e) => sum + e.remaining, 0);
  if (remainingTotal <= 0) return [...packages];
  const shares = unfinished.map((e) => {
    const product = BigInt(e.remaining) * BigInt(amount);
    return {
      id: e.p.id,
      floor: Number(product / BigInt(remainingTotal)),
      rest: product % BigInt(remainingTotal),
    };
  });
  let left = amount - shares.reduce((sum, s) => sum + s.floor, 0);
  const extra = new Map<string, number>();
  const byRest = [...shares].sort(
    (a, b) => (a.rest === b.rest ? 0 : a.rest > b.rest ? -1 : 1) || (a.id < b.id ? -1 : 1),
  );
  for (const share of byRest) {
    if (left <= 0) break;
    extra.set(share.id, 1);
    left -= 1;
  }
  const added = new Map(shares.map((s) => [s.id, s.floor + (extra.get(s.id) ?? 0)]));
  return packages.map((p) => {
    const more = added.get(p.id);
    return more === undefined ? p : { ...p, totalWork: SafeInt.add(p.totalWork, SafeInt(more)) };
  });
}

export function withConstructionOverrun(
  project: ConstructionProject,
  amount: number,
  reasonCode: string,
  month: string,
): ConstructionProject {
  return {
    ...project,
    totalWork: SafeInt.add(project.totalWork, SafeInt(amount)),
    ...(project.packages === undefined
      ? {}
      : { packages: spreadOverUnfinished(project.packages, amount) }),
    overruns: [...(project.overruns ?? []), { month, reasonCode, amount: SafeInt(amount) }],
  };
}
