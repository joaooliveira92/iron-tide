// packages/phase-engine/src/constructionAcceleration.ts
// Engine-side construction acceleration (DESIGN-23 section 8; DESIGN-13 section 11.3 `construction_acceleration_v1`;
// RTW3 manual p. 31). The one-time remaining-work premium, the paid-month work-rate increase and the deterministic
// capacity-pressure delay all live here as pure, integer-only functions so the command path and the monthly
// appropriation phase share exactly one implementation.
//
// All randomness goes through the keyed decision API (`@bluewave/random`): each eligible accelerated project is
// checked in ascending project id order on the stream family `construction/month/project/acceleration_pressure`,
// keyed by nation, campaign month and project id. A delay is never inferred and never invisible: every check writes
// a random-decision ledger record, and a delay additionally carries reason `ACCELERATION_CAPACITY_PRESSURE_DELAY`.

import type { ConstructionPackage, ConstructionProject } from "@bluewave/campaign";
import { constructionAccelerationAllowed } from "@bluewave/campaign";
import { checkedMul, roundToInt, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomDecision, RandomEngine, RandomLedger, RandomStream } from "@bluewave/random";

export { constructionAccelerationAllowed };

/** The versioned policy id of the shipped acceleration ruleset (DESIGN-13 section 11.3). */
export const CONSTRUCTION_ACCELERATION_POLICY_ID = "construction_acceleration_v1" as const;

/** `+5%` remaining-work premium, basis points (DESIGN-13 section 11.3.1; DESIGN-23 section 8). */
export const ACCELERATION_TOTAL_WORK_MULTIPLIER_BP = 10_500 as const;
/** `10%` faster work rate in a paid accelerated month, basis points (DESIGN-13 section 11.3.2; DESIGN-23 section 8). */
export const ACCELERATION_WORK_RATE_MULTIPLIER_BP = 11_000 as const;
/** Accelerated demand weight on a construction pool, basis points (DESIGN-13 section 11.3.3; DESIGN-23 section 9). */
export const ACCELERATION_CAPACITY_PRESSURE_WEIGHT_BP = 12_500 as const;
/** Delay eligibility begins above this capacity pressure, in basis points (strictly greater, DESIGN-13 section 11.3.3). */
export const ACCELERATION_DELAY_THRESHOLD_BP = 9_000 as const;
/** The maximum seeded delay probability, basis points (DESIGN-13 section 11.3.3). */
export const ACCELERATION_DELAY_PROBABILITY_CAP_BP = 5_000 as const;
/** The keyed stream family the delay decisions come from (DESIGN-13 section 11.3.3; DESIGN-23 section 9). */
export const ACCELERATION_STREAM_FAMILY =
  "construction/month/project/acceleration_pressure" as const;

/** Stable reason code of an acceleration capacity-pressure delay (DESIGN-13 section 14; DESIGN-23 section 32). */
export const ACCELERATION_CAPACITY_PRESSURE_DELAY = "ACCELERATION_CAPACITY_PRESSURE_DELAY" as const;
/** Stable reason code when the project type does not allow acceleration (DESIGN-13 section 14). */
export const ACCELERATION_NOT_ALLOWED = "ACCELERATION_NOT_ALLOWED" as const;
/** Stable reason code when the premium is already applied for the current remaining-work segment. */
export const ACCELERATION_PREMIUM_ALREADY_APPLIED = "ACCELERATION_PREMIUM_ALREADY_APPLIED" as const;
/** The reason recorded for an eligible accelerated project whose check did not delay it this month. */
export const ACCELERATION_PRESSURE_CONTINUED = "ACCELERATION_PRESSURE_CONTINUED" as const;

/** The basis-point denominator (10_000 bp = 100%). */
const BP = 10_000;

/** The status an actively-funded project holds: an accelerated project stays accelerated, everything else is active. */
export function constructionWorkStatus(
  status: ConstructionProject["status"],
): "ACTIVE" | "ACCELERATED" {
  return status === "ACCELERATED" ? "ACCELERATED" : "ACTIVE";
}

/**
 * The accelerated remaining work: `ceiling(remainingWorkBeforeAcceleration * 10_500 / 10_000)` (DESIGN-13 section
 * 11.3.1; DESIGN-23 section 8). Checked integer arithmetic only; throws on a negative or unsafe input.
 */
export function acceleratedRemainingWork(remainingWorkBefore: number): number {
  if (!Number.isSafeInteger(remainingWorkBefore) || remainingWorkBefore < 0)
    throw new RangeError(
      `remainingWorkBefore must be a non-negative safe integer, got ${String(remainingWorkBefore)}`,
    );
  return roundToInt(
    checkedMul(remainingWorkBefore, ACCELERATION_TOTAL_WORK_MULTIPLIER_BP) / BP,
    "ceil",
  );
}

/** The extra work the `+5%` premium adds to the remaining work, `acceleratedRemainingWork - remainingWorkBefore`. */
export function accelerationPremiumWork(remainingWorkBefore: number): number {
  return acceleratedRemainingWork(remainingWorkBefore) - remainingWorkBefore;
}

/**
 * The work position (`completedWork`) at or after which the premium was already applied for the current
 * remaining-work segment. `completedWork` never decreases, so re-enabling acceleration without progressing work
 * must not charge again; progressing work starts a new segment (DESIGN-13 section 11.3.1).
 */
export function accelerationPremiumAlreadyApplied(project: ConstructionProject): boolean {
  const marker = project["accelerationPremiumAppliedAtWorkPosition"];
  return marker !== undefined && Number(project["completedWork"]) <= Number(marker);
}

/** Spreads `premiumWork` across the packages, proportional to each package's remaining work, never increasing done work. */
function distributePremium(
  packages: readonly ConstructionPackage[],
  premiumWork: number,
): ConstructionPackage[] {
  const remaining = packages.map((p) =>
    Math.max(0, Number(p["totalWork"]) - Number(p["doneWork"])),
  );
  const totalRemaining = remaining.reduce((sum, value) => sum + value, 0);
  if (totalRemaining <= 0 || premiumWork <= 0) return [...packages];
  const raw = remaining.map((value) => (value * premiumWork) / totalRemaining);
  const added = raw.map((value) => Math.floor(value));
  const leftover = premiumWork - added.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let k = 0; k < leftover; k++) added[order[k % order.length]!["index"]]! += 1;
  return packages.map((p, index) => ({
    ...p,
    totalWork: SafeInt(Number(p["totalWork"]) + added[index]!),
  }));
}

export interface AccelerationPremiumResult {
  readonly project: ConstructionProject;
  /** True when this call newly applied the premium; false when it was already applied for this segment. */
  readonly charged: boolean;
  readonly premiumWork: number;
}

/**
 * Applies the one-time `10_500` bp remaining-work premium (DESIGN-13 section 11.3.1): the project's total work
 * becomes `completedWork + ceiling(remainingWork * 10_500 / 10_000)` and the marker records the work position.
 * Completed work is never increased retroactively, and re-applying for the same segment is refused. For a
 * per-package project the premium is distributed across the packages so `totalWork` stays the sum of package work
 * and the ship can still complete. Pure.
 */
export function applyAccelerationPremium(project: ConstructionProject): AccelerationPremiumResult {
  const remaining = Number(project["totalWork"]) - Number(project["completedWork"]);
  if (remaining <= 0 || accelerationPremiumAlreadyApplied(project))
    return { project, charged: false, premiumWork: 0 };
  const acceleratedRemaining = acceleratedRemainingWork(remaining);
  const premiumWork = acceleratedRemaining - remaining;
  const newTotal = Number(project["completedWork"]) + acceleratedRemaining;
  const packages = project["packages"];
  const withTotal: ConstructionProject = {
    ...project,
    totalWork: SafeInt(newTotal),
  };
  return {
    project: {
      ...(packages === undefined
        ? withTotal
        : { ...withTotal, packages: distributePremium(packages, premiumWork) }),
      accelerationPremiumAppliedAtWorkPosition: project["completedWork"],
    },
    charged: true,
    premiumWork,
  };
}

/**
 * The paid-month effective capacity of an accelerated project: `floor(baseEffectiveCapacity * 11_000 / 10_000)` per
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

/**
 * The monthly capacity a project asks of its construction pool: the design's construction-plan capacity summed over
 * its lines. A project with no plan capacity record (legacy single-figure projects) asks its whole remaining work,
 * matching `constructionProjectReadout`'s instalment. Pure.
 */
export function projectConstructionDemand(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
): number {
  if (capacityUnits === undefined)
    return Math.max(0, Number(project["totalWork"]) - Number(project["completedWork"]));
  return Object.values(capacityUnits).reduce((sum, value) => sum + Number(value), 0);
}

/** `weightedDemand = normalDemand + floor(acceleratedDemand * 12_500 / 10_000)` (DESIGN-13 section 11.3.3). */
export function weightedConstructionDemand(
  normalDemand: number,
  acceleratedDemand: number,
): number {
  return (
    normalDemand +
    roundToInt(
      checkedMul(acceleratedDemand, ACCELERATION_CAPACITY_PRESSURE_WEIGHT_BP) / BP,
      "floor",
    )
  );
}

/** `capacityPressureBp = floor(weightedDemand * 10_000 / max(1, availableCapacity))` (DESIGN-13 section 11.3.3). */
export function constructionCapacityPressureBp(
  weightedDemand: number,
  availableCapacity: number,
): number {
  return roundToInt(checkedMul(weightedDemand, BP) / Math.max(1, availableCapacity), "floor");
}

/** Delay eligibility begins strictly above the `9_000` bp threshold (DESIGN-13 section 11.3.3). */
export function accelerationDelayEligible(capacityPressureBp: number): boolean {
  return capacityPressureBp > ACCELERATION_DELAY_THRESHOLD_BP;
}

/** `excessPressureBp = clamp(0, 10_000, capacityPressureBp - 9_000)` (DESIGN-13 section 11.3.3). */
export function accelerationExcessPressureBp(capacityPressureBp: number): number {
  return Math.max(0, Math.min(BP, capacityPressureBp - ACCELERATION_DELAY_THRESHOLD_BP));
}

/** `delayProbabilityBp = floor(excessPressureBp * 5_000 / 10_000)`, bounded by `5_000` (DESIGN-13 section 11.3.3). */
export function accelerationDelayProbabilityBp(capacityPressureBp: number): number {
  return roundToInt(
    checkedMul(
      accelerationExcessPressureBp(capacityPressureBp),
      ACCELERATION_DELAY_PROBABILITY_CAP_BP,
    ) / BP,
    "floor",
  );
}

/** One keyed basis-point draw from a stream: a whole number in `0..9_999`. */
export function drawAccelerationDelayBp(stream: RandomStream): number {
  return Math.floor(stream.next() * BP);
}

/** Ascending by project id, the canonical order eligible projects are evaluated in (DESIGN-13 section 11.3.3). */
function byProjectId(a: ConstructionProject, b: ConstructionProject): number {
  return a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0;
}

export interface AccelerationPressureInput {
  readonly nationId: string;
  readonly campaignMonth: string;
  readonly normalDemand: number;
  readonly acceleratedDemand: number;
  readonly availableCapacity: number;
  readonly acceleratedProjects: readonly ConstructionProject[];
  readonly randomEngine: RandomEngine;
  readonly randomLedger: RandomLedger;
}

export interface AccelerationPressureOutcome {
  readonly delayedProjectIds: readonly string[];
  readonly weightedDemand: number;
  readonly capacityPressureBp: number;
  readonly delayProbabilityBp: number;
  readonly decisions: readonly RandomDecision[];
}

const EMPTY_PRESSURE: Omit<
  AccelerationPressureOutcome,
  "weightedDemand" | "capacityPressureBp" | "delayProbabilityBp"
> = {
  delayedProjectIds: [],
  decisions: [],
};

/**
 * Evaluates a nation's construction-pool capacity pressure and decides, per eligible accelerated project in
 * ascending id order, whether it is delayed exactly one month (DESIGN-13 section 11.3.3; DESIGN-23 section 9).
 * Every check is a keyed random decision and every check is recorded; a delay additionally carries
 * `ACCELERATION_CAPACITY_PRESSURE_DELAY`. Pure except for the supplied `randomLedger`, which it appends to.
 */
export function resolveAccelerationCapacityPressure(
  input: AccelerationPressureInput,
): AccelerationPressureOutcome {
  const weightedDemand = weightedConstructionDemand(input.normalDemand, input.acceleratedDemand);
  const capacityPressureBp = constructionCapacityPressureBp(
    weightedDemand,
    input.availableCapacity,
  );
  const delayProbabilityBp = accelerationDelayProbabilityBp(capacityPressureBp);
  const projects = [...input.acceleratedProjects].sort(byProjectId);
  if (projects.length === 0 || !accelerationDelayEligible(capacityPressureBp))
    return {
      ...EMPTY_PRESSURE,
      weightedDemand,
      capacityPressureBp,
      delayProbabilityBp,
    };

  const delayedProjectIds: string[] = [];
  const decisions: RandomDecision[] = [];
  for (const project of projects) {
    const stream = input.randomEngine.stream(
      `${ACCELERATION_STREAM_FAMILY}/${input.nationId}/${input.campaignMonth}/${project["id"]}`,
    );
    const draw = drawAccelerationDelayBp(stream);
    const delayed = draw < delayProbabilityBp;
    const decision: RandomDecision = {
      streamId: ACCELERATION_STREAM_FAMILY,
      entityKey: project["id"],
      phase: "appropriation",
      rulesetVersion: CONSTRUCTION_ACCELERATION_POLICY_ID,
      inputHash: sha256Hex(
        canonicalSerialize({
          nationId: input.nationId,
          projectId: project["id"],
          campaignMonth: input.campaignMonth,
          weightedDemand,
          capacityPressureBp,
          delayProbabilityBp,
        }),
      ),
      draw,
      outcome: delayed ? "DELAYED" : "CONTINUED",
      reasonCode: delayed ? ACCELERATION_CAPACITY_PRESSURE_DELAY : ACCELERATION_PRESSURE_CONTINUED,
    };
    input.randomLedger.record(decision);
    decisions.push(decision);
    if (delayed) delayedProjectIds.push(project["id"]);
  }
  return { delayedProjectIds, weightedDemand, capacityPressureBp, delayProbabilityBp, decisions };
}
