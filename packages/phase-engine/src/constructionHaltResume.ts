import type { CompiledDesignVersion, ConstructionProjectStatus } from "@bluewave/campaign";

export const CONSTRUCTION_RESUMED_WITH_CAPACITY = "CONSTRUCTION_RESUMED_WITH_CAPACITY" as const;
export const CONSTRUCTION_RESUMED_AWAITING_CAPACITY =
  "CONSTRUCTION_RESUMED_AWAITING_CAPACITY" as const;
export const CONSTRUCTION_RESUMED_NO_CAPACITY_RECORD =
  "CONSTRUCTION_RESUMED_NO_CAPACITY_RECORD" as const;

export type ConstructionResumeReason =
  | typeof CONSTRUCTION_RESUMED_WITH_CAPACITY
  | typeof CONSTRUCTION_RESUMED_AWAITING_CAPACITY
  | typeof CONSTRUCTION_RESUMED_NO_CAPACITY_RECORD;

export interface ConstructionResumeTarget {
  readonly status: Extract<ConstructionProjectStatus, "ACTIVE" | "AWAITING_CAPACITY">;
  readonly reason: ConstructionResumeReason;
}

export function constructionResumeTarget(
  design: CompiledDesignVersion | undefined,
): ConstructionResumeTarget {
  const plan = design?.constructionPlan;
  if (plan === undefined)
    return { status: "ACTIVE", reason: CONSTRUCTION_RESUMED_NO_CAPACITY_RECORD };
  const totalCapacity = Object.values(plan.capacityUnits).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  return totalCapacity > 0
    ? { status: "ACTIVE", reason: CONSTRUCTION_RESUMED_WITH_CAPACITY }
    : { status: "AWAITING_CAPACITY", reason: CONSTRUCTION_RESUMED_AWAITING_CAPACITY };
}
