// packages/phase-engine/src/constructionHaltResume.ts
// Halting and resuming a dockyard project (DESIGN-23 section 7; RTW3 manual pp. 30-31). Pure helpers shared by the
// player command path and the monthly appropriation resolution, so a halt/resume decision is made in exactly one place.

import type { CompiledDesignVersion, ConstructionProjectStatus } from "@bluewave/campaign";

/** A project resumed with usable capacity is simply ACTIVE. */
export const CONSTRUCTION_RESUMED_WITH_CAPACITY = "CONSTRUCTION_RESUMED_WITH_CAPACITY" as const;
/** A project resumed with no usable construction capacity waits for it. */
export const CONSTRUCTION_RESUMED_AWAITING_CAPACITY =
  "CONSTRUCTION_RESUMED_AWAITING_CAPACITY" as const;
/** No compiled design (or no plan) records capacity, so the project activates and the reason is recorded. */
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

/**
 * Where a resumed project goes. The engine has no separate construction-capacity reservation for this path yet, so the
 * design's own compiled construction plan is the capacity record: a plan whose lines grant some capacity (or a project
 * with no plan at all, the legacy/single-figure case) resumes ACTIVE; a plan that grants no capacity anywhere waits in
 * AWAITING_CAPACITY. Pure and deterministic; the reason is always recorded so no resume decision is silent.
 */
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
