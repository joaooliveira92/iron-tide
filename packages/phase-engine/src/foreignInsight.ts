import type {
  ForeignConstructionContract,
  ForeignInsightAwardRecord,
  ResearchState,
} from "@bluewave/campaign";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";

export const FOREIGN_INSIGHT_POLICY_ID = "foreign_construction_insight_v1" as const;

export const FOREIGN_INSIGHT_MILESTONES = [
  "DESIGN_STUDY",
  "CONSTRUCTION_OBSERVATION",
  "DELIVERY",
] as const;

export type ForeignInsightMilestone = (typeof FOREIGN_INSIGHT_MILESTONES)[number];

export const FOREIGN_INSIGHT_MILESTONE_MICRO_POINTS: Readonly<
  Record<ForeignInsightMilestone, number>
> = {
  DESIGN_STUDY: 500,
  CONSTRUCTION_OBSERVATION: 1_000,
  DELIVERY: 1_500,
};

export const FOREIGN_INSIGHT_PER_FAMILY_CAP_MICRO_POINTS = 3_000;

export const FOREIGN_INSIGHT_ELIGIBLE_FAMILIES: readonly string[] = [
  ...CANONICAL_RESEARCH_FIELD_IDS,
];

const MILESTONE_RANK: Readonly<Record<string, number>> = {
  DESIGN_STUDY: 0,
  CONSTRUCTION_OBSERVATION: 1,
  DELIVERY: 2,
};

const milestoneRank = (milestone: string): number =>
  MILESTONE_RANK[milestone] ?? FOREIGN_INSIGHT_MILESTONES.length;

export function isForeignInsightContract(contract: ForeignConstructionContract): boolean {
  return contract["technologyTransferPolicyId"] === FOREIGN_INSIGHT_POLICY_ID;
}

export function foreignInsightEligibleFamilies(
  _contract: ForeignConstructionContract,
): readonly string[] {
  return FOREIGN_INSIGHT_ELIGIBLE_FAMILIES;
}

export interface ForeignInsightAward {
  readonly familyId: string;
  readonly techId: string;
  readonly microPoints: number;
}

export interface ForeignInsightResolveInput {
  readonly contract: ForeignConstructionContract;
  readonly milestone: ForeignInsightMilestone;
  readonly record?: ForeignInsightAwardRecord;
  readonly research: ResearchState;
  readonly remainingRequirementFor: (techId: string) => number | undefined;
}

export interface ForeignInsightResolution {
  readonly awards: readonly ForeignInsightAward[];
  readonly record: ForeignInsightAwardRecord | undefined;
}

const strCmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(strCmp);
}

function recordFrom(values: ReadonlyMap<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...values.keys()].sort(strCmp)) out[key] = values.get(key)!;
  return out;
}

export function resolveForeignInsight(input: ForeignInsightResolveInput): ForeignInsightResolution {
  const { contract, milestone, research, remainingRequirementFor } = input;
  if (!isForeignInsightContract(contract)) return { awards: [], record: input.record };

  const current = input.record;
  if (current !== undefined && current["milestones"].includes(milestone))
    return { awards: [], record: current };

  const milestonePoints = FOREIGN_INSIGHT_MILESTONE_MICRO_POINTS[milestone];
  const awardedByFamily = new Map(Object.entries(current?.["awardedByFamily"] ?? {}));
  const awards: ForeignInsightAward[] = [];

  for (const familyId of sortedUnique(foreignInsightEligibleFamilies(contract))) {
    const techId = research["activeCandidates"].get(familyId);
    if (techId === undefined) continue;
    const tech = research["technologies"].find((t) => t["techId"] === techId);
    if (tech === undefined || tech["completed"] === true) continue;
    if (research["discoveredTechs"].includes(techId)) continue;

    const remaining = remainingRequirementFor(techId);
    if (remaining !== undefined && remaining <= 0) continue;

    const familyAwarded = awardedByFamily.get(familyId) ?? 0;
    const capRemaining = FOREIGN_INSIGHT_PER_FAMILY_CAP_MICRO_POINTS - familyAwarded;
    const bounded = Math.min(milestonePoints, capRemaining, remaining ?? Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(bounded) || bounded <= 0) continue;

    awards.push({ familyId, techId, microPoints: bounded });
    awardedByFamily.set(familyId, familyAwarded + bounded);
  }

  if (awards.length === 0) return { awards: [], record: input.record };

  const milestones = sortedUnique([...(current?.["milestones"] ?? []), milestone]).sort(
    (a, b) => milestoneRank(a) - milestoneRank(b) || strCmp(a, b),
  );
  return {
    awards,
    record: {
      contractId: contract["contractId"],
      milestones,
      awardedByFamily: recordFrom(awardedByFamily),
    },
  };
}

export function applyForeignInsightAwards(
  research: ResearchState,
  awards: readonly ForeignInsightAward[],
): ResearchState {
  if (awards.length === 0) return research;
  const byTech = new Map<string, number>();
  for (const award of awards)
    byTech.set(award.techId, (byTech.get(award.techId) ?? 0) + award.microPoints);
  const technologies = research["technologies"].map((tech) => {
    const add = byTech.get(tech["techId"]);
    if (add === undefined) return tech;
    return { ...tech, investedPoints: SafeInt.add(tech["investedPoints"], SafeInt(add)) };
  });
  return { ...research, technologies };
}

export interface ForeignInsightMilestonesDueInput {
  readonly paidWork: number;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly completed: boolean;
  readonly record?: ForeignInsightAwardRecord;
}

export function foreignInsightMilestonesDue(
  input: ForeignInsightMilestonesDueInput,
): readonly ForeignInsightMilestone[] {
  const total = input.totalWork;
  if (!Number.isSafeInteger(total) || total <= 0) return [];
  const recorded = new Set(input.record?.["milestones"] ?? []);
  const due: ForeignInsightMilestone[] = [];
  if (
    Number.isSafeInteger(input.paidWork) &&
    input.paidWork * 2 >= total &&
    !recorded.has("CONSTRUCTION_OBSERVATION")
  )
    due.push("CONSTRUCTION_OBSERVATION");
  if (
    (input.completed ||
      (Number.isSafeInteger(input.completedWork) && input.completedWork >= total)) &&
    !recorded.has("DELIVERY")
  )
    due.push("DELIVERY");
  return due;
}

export interface ForeignInsightApplication {
  readonly awards: readonly ForeignInsightAward[];
  readonly research: ResearchState;
  readonly record: ForeignInsightAwardRecord | undefined;
}

export function applyForeignInsightMilestone(
  input: ForeignInsightResolveInput,
): ForeignInsightApplication {
  const resolution = resolveForeignInsight(input);
  return {
    awards: resolution.awards,
    research: applyForeignInsightAwards(input.research, resolution.awards),
    record: resolution.record,
  };
}

export function makeRemainingRequirementFor(
  research: ResearchState,
  costOf: (techId: string) => number | undefined,
): (techId: string) => number | undefined {
  const invested = new Map(
    research["technologies"].map((t) => [t["techId"], Number(t["investedPoints"])] as const),
  );
  return (techId) => {
    const cost = costOf(techId);
    if (cost === undefined) return undefined;
    return cost - (invested.get(techId) ?? 0);
  };
}

export function mergeForeignInsightAwardRecord(
  records: ForeignInsightAwardRecord[] | undefined,
  record: ForeignInsightAwardRecord | undefined,
): ForeignInsightAwardRecord[] | undefined {
  if (record === undefined) return records;
  const out = [...(records ?? [])];
  const at = out.findIndex((r) => r["contractId"] === record["contractId"]);
  if (at >= 0) out[at] = record;
  else out.push(record);
  out.sort((a, b) => strCmp(a["contractId"], b["contractId"]));
  return out;
}
