import {
  constructionPlanOf,
  packageProgressOf,
  type ConstructionMonthUsage,
  type ConstructionPackage,
  type ConstructionPackageKind,
  type ConstructionPlanRecord,
  type ConstructionProject,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  buildProgressOf,
  type BuildProgress,
  type ChangeKind,
  type RevisionDecision,
} from "@bluewave/ship-design";
export function projectBuildProgress(project: ConstructionProject): BuildProgress | undefined {
  const packages = project["packages"];
  if (packages === undefined) return undefined;
  return buildProgressOf(constructionPlanOf(packages), packageProgressOf(packages));
}

const REWORK_PACKAGE: Readonly<Record<ChangeKind, ConstructionPackageKind>> = {
  STRUCTURE: "HULL",
  ARMOUR: "ARMOUR",
  MACHINERY: "MACHINERY",
  MAIN_ARMAMENT: "ORDNANCE",
  FITTINGS: "FIT_OUT",
};
const REWORK_ORDER: readonly ChangeKind[] = [
  "STRUCTURE",
  "ARMOUR",
  "MACHINERY",
  "MAIN_ARMAMENT",
  "FITTINGS",
];

export interface RevisedPackages {
  readonly packages: ConstructionPackage[];
  readonly totalWork: number;
  readonly completedWork: number;
  readonly yardId: string;
  readonly monthUsage: ConstructionMonthUsage | undefined;
}

export function revisePackages(
  project: ConstructionProject,
  newPlan: ConstructionPlanRecord | undefined,
  decision: Pick<RevisionDecision, "tier" | "reworkWorkMicro" | "hullDoneWorkAfter">,
  kinds: readonly ChangeKind[],
): RevisedPackages | null {
  const old = project["packages"];
  if (old === undefined || newPlan === undefined) return null;
  const oldById = new Map(old.map((p) => [p["id"], p]));
  const rescale = (id: string, value: number, newTotal: number): number => {
    const oldTotal = (oldById.get(id)?.["totalWork"] as number | undefined) ?? 0;
    if (oldTotal <= 0) return 0;
    return Math.min(newTotal, Number((BigInt(value) * BigInt(newTotal)) / BigInt(oldTotal)));
  };

  const reworkKind = REWORK_ORDER.find((k) => kinds.includes(k));
  const reworkPackage =
    reworkKind === undefined
      ? undefined
      : newPlan.packages.find((p) => p["kind"] === REWORK_PACKAGE[reworkKind])?.["id"];
  const rework = decision.tier === "T1_REVISION" ? Math.max(0, decision.reworkWorkMicro) : 0;

  let packages: ConstructionPackage[] = newPlan.packages.map((p) => {
    const total = (p["totalWork"] as number) + (p["id"] === reworkPackage ? rework : 0);
    const planned = p["totalWork"] as number;
    return {
      id: p["id"],
      kind: p["kind"],
      line: p["line"],
      totalWork: SafeInt(total),
      doneWork: SafeInt(
        rescale(p["id"], (oldById.get(p["id"])?.["doneWork"] as number) ?? 0, planned),
      ),
      dependsOn: [...p["dependsOn"]],
    };
  });
  if (rework > 0 && reworkPackage === undefined) {
    const hull = packages.find((p) => p["kind"] === "HULL");
    if (hull)
      packages = packages.map((p) =>
        p === hull ? { ...p, totalWork: SafeInt((p["totalWork"] as number) + rework) } : p,
      );
  }

  if (decision.tier === "T2_REDESIGN") {
    let keep = decision.hullDoneWorkAfter;
    packages = packages.map((p) => {
      if (p["kind"] !== "HULL") return { ...p, doneWork: SafeInt(0) };
      const done = Math.min(keep, p["totalWork"] as number);
      keep -= done;
      return { ...p, doneWork: SafeInt(done) };
    });
  }

  const usage = project["monthUsage"];
  const monthUsage =
    usage === undefined
      ? undefined
      : {
          month: usage["month"],
          used: { ...usage["used"] },
          startDone: Object.fromEntries(
            newPlan.packages.map((p) => [
              p["id"],
              SafeInt(
                Math.min(
                  packages.find((x) => x["id"] === p["id"])!["doneWork"] as number,
                  rescale(
                    p["id"],
                    (usage["startDone"][p["id"]] as number | undefined) ?? 0,
                    p["totalWork"] as number,
                  ),
                ),
              ),
            ]),
          ),
        };

  return {
    packages,
    totalWork: packages.reduce((a, p) => a + (p["totalWork"] as number), 0),
    completedWork: packages.reduce((a, p) => a + (p["doneWork"] as number), 0),
    yardId: newPlan.yardId,
    monthUsage,
  };
}
