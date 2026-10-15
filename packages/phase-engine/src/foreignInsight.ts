// DESIGN-16 section 13.5 (spec SB3-R24): the technology insight a foreign construction contract transfers to the
// ordering nation. Three milestones post research micro-points into the EXISTING research model — never a
// technology: design-study `500` at acceptance, construction-observation `1_000` at 50% paid work and delivery
// `1_500` — capped at `3_000` per technology family and contract. A milestone already awarded is never awarded
// again, a family whose relevant technology is already known awards nothing, and an award never exceeds the
// technology's remaining research requirement. The module is pure, integer-only and deterministic: eligible
// families are evaluated in ascending id order and every result is a plain value.
//
// The compiled design version does not persist a major-technology-family list, so the eligible families are
// authored by the shipped policy (the canonical research fields — the technology chains' families). See the INC-11
// answer for the recorded decision.
import type {
  ForeignConstructionContract,
  ForeignInsightAwardRecord,
  ResearchState,
} from "@bluewave/campaign";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";

/** DESIGN-16 section 13.5: the shipped technology-transfer policy identifier. */
export const FOREIGN_INSIGHT_POLICY_ID = "foreign_construction_insight_v1" as const;

/** The three insight milestones, in canonical order. */
export const FOREIGN_INSIGHT_MILESTONES = [
  "DESIGN_STUDY",
  "CONSTRUCTION_OBSERVATION",
  "DELIVERY",
] as const;

export type ForeignInsightMilestone = (typeof FOREIGN_INSIGHT_MILESTONES)[number];

/** The exact research micro-points each milestone grants per eligible family (section 13.5). */
export const FOREIGN_INSIGHT_MILESTONE_MICRO_POINTS: Readonly<
  Record<ForeignInsightMilestone, number>
> = {
  DESIGN_STUDY: 500,
  CONSTRUCTION_OBSERVATION: 1_000,
  DELIVERY: 1_500,
};

/** The maximum total insight per technology family and contract (section 13.5). */
export const FOREIGN_INSIGHT_PER_FAMILY_CAP_MICRO_POINTS = 3_000;

/**
 * DESIGN-16 section 13.5: the authored eligible major technology families of the shipped
 * `foreign_construction_insight_v1` policy. The compiled design carries no such list, so the policy — selected by
 * the contract's `technologyTransferPolicyId` — is the explicit authoritative source. The canonical research
 * fields are the technology chains' families (DESIGN-20 section 1).
 */
export const FOREIGN_INSIGHT_ELIGIBLE_FAMILIES: readonly string[] = [
  ...CANONICAL_RESEARCH_FIELD_IDS,
];

/** The milestone's position in canonical order, used to keep persisted records stable. */
const MILESTONE_RANK: Readonly<Record<string, number>> = {
  DESIGN_STUDY: 0,
  CONSTRUCTION_OBSERVATION: 1,
  DELIVERY: 2,
};

/** Canonical order for a milestone id; an unknown (corrupt) id sorts after the known ones, then lexicographically. */
const milestoneRank = (milestone: string): number =>
  MILESTONE_RANK[milestone] ?? FOREIGN_INSIGHT_MILESTONES.length;

/** Whether a contract selects the shipped insight policy (section 13.5). */
export function isForeignInsightContract(contract: ForeignConstructionContract): boolean {
  return contract["technologyTransferPolicyId"] === FOREIGN_INSIGHT_POLICY_ID;
}

/**
 * The eligible families for a contract: the shipped `foreign_construction_insight_v1` policy's authored list
 * (`FOREIGN_INSIGHT_ELIGIBLE_FAMILIES` — the canonical research fields). The compiled design carries no
 * major-technology-family list, so the policy is the authoritative source. The parameter is retained so a future
 * design-derived narrowing can intersect without changing the call sites.
 */
export function foreignInsightEligibleFamilies(
  _contract: ForeignConstructionContract,
): readonly string[] {
  return FOREIGN_INSIGHT_ELIGIBLE_FAMILIES;
}

/** One family's award: the research micro-points posted into the family's active technology. */
export interface ForeignInsightAward {
  readonly familyId: string;
  readonly techId: string;
  readonly microPoints: number;
}

export interface ForeignInsightResolveInput {
  readonly contract: ForeignConstructionContract;
  readonly milestone: ForeignInsightMilestone;
  /** The award record already persisted for the contract; absent until the first award. */
  readonly record?: ForeignInsightAwardRecord;
  /** The ordering nation's research model. */
  readonly research: ResearchState;
  /**
   * The remaining research requirement of a technology (`cost - progress`), or `undefined` when the research model
   * carries no cost for it (the award is then bounded only by the family cap, never by a fabricated requirement).
   */
  readonly remainingRequirementFor: (techId: string) => number | undefined;
}

export interface ForeignInsightResolution {
  /** Awards for this milestone, ascending by family id; empty when nothing is due or eligible. */
  readonly awards: readonly ForeignInsightAward[];
  /** The updated award record, or the input record unchanged when no award was made. */
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

/**
 * DESIGN-16 section 13.5: resolve one milestone's insight awards. Returns nothing (and the record unchanged) when
 * the contract does not select the policy, when the milestone was already awarded, when no eligible family has an
 * active technology the ordering nation still lacks, or when every candidate is already at its cap or its
 * remaining requirement. Never sets `completed` or `discoveredTechs`, so no technology is granted directly,
 * no prerequisite is bypassed and no availability date moves. Pure and deterministic.
 */
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

/**
 * Post the awards into the existing research model: each award adds micro-points to its technology's
 * `investedPoints`. It never sets `completed`, never edits `discoveredTechs`, `activeCandidates` or
 * `fieldPriorities`, and never moves an availability date — discovery stays the research phase's decision. The
 * entries are updated in their existing order so the state hash stays stable. Pure.
 */
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
  /** Paid work reaching half the project's total work (`2 * paidWork >= totalWork`) is the observation gate. */
  readonly paidWork: number;
  readonly completedWork: number;
  readonly totalWork: number;
  /** Whether the project has completed (delivered). */
  readonly completed: boolean;
  readonly record?: ForeignInsightAwardRecord;
}

/**
 * The monthly insight gates (section 13.5), in canonical order: construction-observation once half the work is
 * paid, then delivery once the project is complete. A milestone already recorded is excluded. Pure.
 *
 * NOTE (INC-10 will distinguish work-complete from delivered): the `completed || completedWork >= totalWork`
 * delivery test currently coincides because a foreign `NEW_CONSTRUCTION` project completes on work-complete — a
 * `COMPLETED` status is reached exactly when its unlocked work reaches `totalWork`. When INC-10 separates
 * "work complete" from "delivered" (e.g. a delivery/acceptance step distinct from the last work unit), the
 * `completed` flag must become the delivery authority and `completedWork >= totalWork` alone must not award DELIVERY.
 */
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

/** The resolved and applied result of one insight milestone. */
export interface ForeignInsightApplication {
  readonly awards: readonly ForeignInsightAward[];
  readonly research: ResearchState;
  readonly record: ForeignInsightAwardRecord | undefined;
}

/** Resolve a milestone and post its awards into the research model in one step. Pure. */
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

/**
 * Build the `remainingRequirementFor` callback the resolver reads from the research model's own progress and a
 * cost lookup: `cost - invested`, or `undefined` for a technology the model carries no cost for. Pure.
 */
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

/**
 * Merge one contract's award record into a nation's records, preserving ascending contract-id order. Returns the
 * input (possibly `undefined`) unchanged when there is no new record, so the field stays absent until the first
 * award and an existing save hash never moves. Pure.
 */
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
