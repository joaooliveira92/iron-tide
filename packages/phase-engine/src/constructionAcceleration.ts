import type { ConstructionPackage, ConstructionProject } from "@bluewave/campaign";
import {
  accelerateCapacityUnits,
  constructionAccelerationAllowed,
  constructionWorkStatus,
  monthlyAbsorbable,
} from "@bluewave/campaign";
import { checkedMul, roundToInt, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomDecision, RandomEngine, RandomLedger, RandomStream } from "@bluewave/random";
import {
  accelerationTermsOf,
  type AccelerationTerms,
  type ShipBuildingContent,
} from "@bluewave/ship-design";

export {
  accelerateCapacityUnits,
  constructionAccelerationAllowed,
  constructionWorkStatus,
  type AccelerationTerms,
};

export const CONSTRUCTION_ACCELERATION_POLICY_ID = "construction_acceleration_v1" as const;

export const ACCELERATION_STREAM_FAMILY =
  "construction/month/project/acceleration_pressure" as const;

export const ACCELERATION_CAPACITY_PRESSURE_DELAY = "ACCELERATION_CAPACITY_PRESSURE_DELAY" as const;
export const ACCELERATION_NOT_ALLOWED = "ACCELERATION_NOT_ALLOWED" as const;
export const ACCELERATION_PREMIUM_ALREADY_APPLIED = "ACCELERATION_PREMIUM_ALREADY_APPLIED" as const;
export const ACCELERATION_PRESSURE_CONTINUED = "ACCELERATION_PRESSURE_CONTINUED" as const;

const BP = 10_000;

export function acceleratedRemainingWork(
  remainingWorkBefore: number,
  terms: AccelerationTerms,
): number {
  if (!Number.isSafeInteger(remainingWorkBefore) || remainingWorkBefore < 0)
    throw new RangeError(
      `remainingWorkBefore must be a non-negative safe integer, got ${String(remainingWorkBefore)}`,
    );
  return roundToInt(checkedMul(remainingWorkBefore, terms.workMultiplierBp) / BP, "ceil");
}

export function accelerationPremiumWork(
  remainingWorkBefore: number,
  terms: AccelerationTerms,
): number {
  return acceleratedRemainingWork(remainingWorkBefore, terms) - remainingWorkBefore;
}

export function accelerationPremiumAlreadyApplied(project: ConstructionProject): boolean {
  const marker = project["accelerationPremiumAppliedAtWorkPosition"];
  return marker !== undefined && Number(project["completedWork"]) <= Number(marker);
}

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
  readonly charged: boolean;
  readonly premiumWork: number;
}

export function applyAccelerationPremium(
  project: ConstructionProject,
  terms: AccelerationTerms,
): AccelerationPremiumResult {
  const remaining = Number(project["totalWork"]) - Number(project["completedWork"]);
  if (remaining <= 0 || accelerationPremiumAlreadyApplied(project))
    return { project, charged: false, premiumWork: 0 };
  const acceleratedRemaining = acceleratedRemainingWork(remaining, terms);
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

export function accelerationTermsFor(
  shipBuilding: Pick<ShipBuildingContent, "environmentFor"> | undefined,
  month: string,
): AccelerationTerms | undefined {
  if (shipBuilding === undefined) return undefined;
  const environment = shipBuilding.environmentFor(month);
  return accelerationTermsOf(environment.constructionBalance, environment.costBalance);
}

export function accelerationStartedProject(
  project: ConstructionProject,
  terms: AccelerationTerms,
  month: string,
): ConstructionProject {
  const premium = applyAccelerationPremium(project, terms);
  return {
    ...premium.project,
    acceleratedFromMonth: month,
    acceleratedFromWork: premium.project["completedWork"],
  };
}

export function projectConstructionDemand(
  project: ConstructionProject,
  capacityUnits: Readonly<Record<string, number>> | undefined,
  month: string,
  terms?: AccelerationTerms,
): number {
  return monthlyAbsorbable(project, capacityUnits, month, terms);
}

export function weightedConstructionDemand(
  normalDemand: number,
  acceleratedDemand: number,
  terms: AccelerationTerms,
): number {
  return (
    normalDemand + roundToInt(checkedMul(acceleratedDemand, terms.pressureWeightBp) / BP, "floor")
  );
}

export function constructionCapacityPressureBp(
  weightedDemand: number,
  availableCapacity: number,
): number {
  return roundToInt(checkedMul(weightedDemand, BP) / Math.max(1, availableCapacity), "floor");
}

export function accelerationDelayEligible(
  capacityPressureBp: number,
  terms: AccelerationTerms,
): boolean {
  return capacityPressureBp > terms.delayThresholdBp;
}

export function accelerationExcessPressureBp(
  capacityPressureBp: number,
  terms: AccelerationTerms,
): number {
  return Math.max(0, Math.min(BP, capacityPressureBp - terms.delayThresholdBp));
}

export function accelerationDelayProbabilityBp(
  capacityPressureBp: number,
  terms: AccelerationTerms,
): number {
  return roundToInt(
    checkedMul(
      accelerationExcessPressureBp(capacityPressureBp, terms),
      terms.delayProbabilityCapBp,
    ) / BP,
    "floor",
  );
}

export function drawAccelerationDelayBp(stream: RandomStream): number {
  return Math.floor(stream.next() * BP);
}

function byProjectId(a: ConstructionProject, b: ConstructionProject): number {
  return a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0;
}

export interface AccelerationPressureInput {
  readonly nationId: string;
  readonly campaignMonth: string;
  readonly normalDemand: number;
  readonly acceleratedDemand: number;
  readonly availableCapacity: number;
  readonly terms: AccelerationTerms;
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

export function resolveAccelerationCapacityPressure(
  input: AccelerationPressureInput,
): AccelerationPressureOutcome {
  const weightedDemand = weightedConstructionDemand(
    input.normalDemand,
    input.acceleratedDemand,
    input.terms,
  );
  const capacityPressureBp = constructionCapacityPressureBp(
    weightedDemand,
    input.availableCapacity,
  );
  const delayProbabilityBp = accelerationDelayProbabilityBp(capacityPressureBp, input.terms);
  const projects = [...input.acceleratedProjects].sort(byProjectId);
  if (projects.length === 0 || !accelerationDelayEligible(capacityPressureBp, input.terms))
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

const POOL_EXCLUDED = new Set<ConstructionProject["status"]>(["COMPLETED", "CANCELLED"]);

export function accelerationPoolUnitsOf(
  projects: readonly ConstructionProject[],
  capacityOf: (project: ConstructionProject) => Readonly<Record<string, number>> | undefined,
  terms: AccelerationTerms,
): number {
  let largestRate = 0;
  for (const project of projects) {
    if (POOL_EXCLUDED.has(project["status"])) continue;
    const capacity = capacityOf(project);
    if (capacity === undefined) continue;
    largestRate = Math.max(largestRate, ...Object.values(capacity));
  }
  return roundToInt(checkedMul(largestRate, terms.poolMultipleBp) / BP, "floor");
}

export interface AccelerationDemand {
  readonly normalDemand: number;
  readonly acceleratedDemand: number;
}

const DEMAND_EXCLUDED = new Set<ConstructionProject["status"]>(["HALTED", "DELAYED", "COMPLETED"]);

export function accelerationDemandOf(
  projects: readonly ConstructionProject[],
  capacityOf: (project: ConstructionProject) => Readonly<Record<string, number>> | undefined,
  month: string,
  terms: AccelerationTerms,
): AccelerationDemand {
  let normalDemand = 0;
  let acceleratedDemand = 0;
  for (const project of projects) {
    if (DEMAND_EXCLUDED.has(project["status"])) continue;
    const demand = projectConstructionDemand(project, capacityOf(project), month, terms);
    if (project["status"] === "ACCELERATED") acceleratedDemand += demand;
    else normalDemand += demand;
  }
  return { normalDemand, acceleratedDemand };
}

export interface AccelerationPressure {
  readonly weightedDemand: number;
  readonly capacityPressureBp: number;
  readonly delayProbabilityBp: number;
}

export function accelerationPressureOf(
  demand: AccelerationDemand,
  poolUnits: number,
  terms: AccelerationTerms,
): AccelerationPressure {
  const weightedDemand = weightedConstructionDemand(
    demand.normalDemand,
    demand.acceleratedDemand,
    terms,
  );
  const capacityPressureBp = constructionCapacityPressureBp(weightedDemand, poolUnits);
  return {
    weightedDemand,
    capacityPressureBp,
    delayProbabilityBp: accelerationDelayProbabilityBp(capacityPressureBp, terms),
  };
}

export interface NationAccelerationPressure extends AccelerationPressure {
  readonly poolUnits: number;
  readonly demand: AccelerationDemand;
}

export function nationAccelerationPressureOf(
  projects: readonly ConstructionProject[],
  capacityOf: (project: ConstructionProject) => Readonly<Record<string, number>> | undefined,
  month: string,
  terms: AccelerationTerms,
): NationAccelerationPressure {
  const demand = accelerationDemandOf(projects, capacityOf, month, terms);
  const poolUnits = accelerationPoolUnitsOf(projects, capacityOf, terms);
  return { ...accelerationPressureOf(demand, poolUnits, terms), poolUnits, demand };
}
