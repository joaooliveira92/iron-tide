import type {
  ConstructionMonthUsage,
  ConstructionPackage,
  ConstructionPackageKind,
  ConstructionPlanRecord,
  ConstructionProject,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  buildProgressOf,
  type BuildProgress,
  type ChangeKind,
  type RevisionDecision,
} from "@bluewave/ship-design";
import { doneOf, planOf } from "./constructionFunding.js";

/**
 * What the revision rules need to know about a project's build, read from its real package state (ADR-0077): hull progress,
 * whether armour or machinery work has started, whether the ship is launched. Undefined for a project without packages,
 * which keeps the single-figure reading.
 */
export function projectBuildProgress(project: ConstructionProject): BuildProgress | undefined {
  const packages = project["packages"];
  if (packages === undefined) return undefined;
  return buildProgressOf(planOf(packages), doneOf(packages));
}

/** The package a kind of change reworks, in the order rework is charged when several kinds change. */
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

/**
 * The packages of a revised project (ADR-0077, ADR-0070): the new design's plan in treasury units, with the work already done
 * carried over in proportion (`floor(done x newTotal / oldTotal)` per package, so the share built is kept), then the revision
 * rules applied.
 *
 * - T0 (free) and T1 (revision): the share done is kept. T1's rework is added to the total of the package its change kind
 *   reworks (the first of structure, armour, machinery, main armament, fittings that changed), so remaining work grows by the
 *   rework exactly as the single-figure model's `totalWork + rework` did.
 * - T2 (redesign): only hull work survives, up to `hullDoneWorkAfter`; every other package starts again.
 *
 * `completedWork` is the sum of done work and `totalWork` the sum of totals, so the project's invariants hold. Pure. The
 * month usage is carried (rescaled the same way) so capacity already used this month is not forgotten. Returns null when the
 * new design has no plan or its packages cannot be matched, in which case the caller drops the packages.
 */
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
  // Rework on a package that had no matching rework target is charged to the hull, the one package every plan has.
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
