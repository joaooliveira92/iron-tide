import type {
  ConstructionProject,
  ForeignConstructionContract,
  ForeignContractImpoundmentRecord,
  NationState,
} from "@bluewave/campaign";
import { canTransitionConstructionProject } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomDecision, RandomEngine, RandomLedger } from "@bluewave/random";
import { FOREIGN_DELIVERY_GUARANTEE_NONE } from "./foreignConstruction.js";

export const FOREIGN_CONTRACT_WAR_POLICY_ID = "foreign_contract_war_policy_v1" as const;

export const FOREIGN_WAR_OUTCOMES = [
  "CONTINUE",
  "DELAY",
  "SUSPEND",
  "IMPOUND",
  "CANCEL_WITH_SETTLEMENT",
  "PHYSICALLY_IMPOSSIBLE",
] as const;
export type ForeignContractWarOutcome = (typeof FOREIGN_WAR_OUTCOMES)[number];

export const FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED =
  "FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED" as const;
export const DELIVERY_GUARANTEE_ACTIVE = "DELIVERY_GUARANTEE_ACTIVE" as const;
export const FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE =
  "FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE" as const;
export const FOREIGN_CONTRACT_DELIVERY_DELAYED = "FOREIGN_CONTRACT_DELIVERY_DELAYED" as const;

export const FOREIGN_IMPOUNDMENT_STREAM_FAMILY = "foreign_contract/war/impoundment" as const;
export const FOREIGN_IMPOUNDMENT_AUTHORIZED = "FOREIGN_IMPOUNDMENT_AUTHORIZED" as const;
export const FOREIGN_IMPOUNDMENT_NOT_DRAWN = "FOREIGN_IMPOUNDMENT_NOT_DRAWN" as const;
export const FOREIGN_IMPOUNDMENT_TENSION_SLOPE_BP = 1_000 as const;
export const FOREIGN_IMPOUNDMENT_MAX_PROBABILITY_BP = 9_000 as const;
export const FOREIGN_IMPOUNDMENT_MIN_TENSION = 6 as const;

export function impoundmentProbabilityBp(tension: number): number {
  const clamped = Number.isFinite(tension) ? Math.min(10, Math.max(0, Math.floor(tension))) : 0;
  if (clamped < FOREIGN_IMPOUNDMENT_MIN_TENSION) return 0;
  return Math.min(
    FOREIGN_IMPOUNDMENT_MAX_PROBABILITY_BP,
    clamped * FOREIGN_IMPOUNDMENT_TENSION_SLOPE_BP,
  );
}

export interface ForeignWarOutcomeEffects {
  readonly payment: "SCHEDULED" | "SUSPENDED" | "SETTLED" | "FORFEITED";
  readonly work: "CONTINUE" | "ZERO";
  readonly capacity: "RETAINED" | "RELEASED";
  readonly incompleteHullOwnership:
    | "BUILDER"
    | "ORDERING_NATION"
    | "BUILDER_CUSTODY"
    | "CONTROLLING_AUTHORITY";
  readonly refund: "NONE" | "SETTLEMENT" | "FORFEIT_OR_COMPENSATION";
  readonly delivery:
    | "PLANNED"
    | "DELAYED"
    | "SUSPENDED"
    | "NOT_ELIGIBLE"
    | "CANCELLED"
    | "IMPOSSIBLE";
}

export const FOREIGN_WAR_OUTCOME_EFFECTS: Readonly<
  Record<ForeignContractWarOutcome, ForeignWarOutcomeEffects>
> = {
  CONTINUE: {
    payment: "SCHEDULED",
    work: "CONTINUE",
    capacity: "RETAINED",
    incompleteHullOwnership: "BUILDER",
    refund: "NONE",
    delivery: "PLANNED",
  },
  DELAY: {
    payment: "SUSPENDED",
    work: "ZERO",
    capacity: "RETAINED",
    incompleteHullOwnership: "BUILDER",
    refund: "NONE",
    delivery: "DELAYED",
  },
  SUSPEND: {
    payment: "SUSPENDED",
    work: "ZERO",
    capacity: "RELEASED",
    incompleteHullOwnership: "BUILDER",
    refund: "NONE",
    delivery: "SUSPENDED",
  },
  IMPOUND: {
    payment: "FORFEITED",
    work: "ZERO",
    capacity: "RELEASED",
    incompleteHullOwnership: "BUILDER_CUSTODY",
    refund: "FORFEIT_OR_COMPENSATION",
    delivery: "NOT_ELIGIBLE",
  },
  CANCEL_WITH_SETTLEMENT: {
    payment: "SETTLED",
    work: "ZERO",
    capacity: "RELEASED",
    incompleteHullOwnership: "BUILDER",
    refund: "SETTLEMENT",
    delivery: "CANCELLED",
  },
  PHYSICALLY_IMPOSSIBLE: {
    payment: "SETTLED",
    work: "ZERO",
    capacity: "RELEASED",
    incompleteHullOwnership: "BUILDER",
    refund: "SETTLEMENT",
    delivery: "IMPOSSIBLE",
  },
};

export const FOREIGN_SETTLEMENT_POLICY_ID = "foreign_contract_settlement_v1" as const;
export const FOREIGN_SETTLEMENT_CATEGORY_ID = "foreign_contract_settlement" as const;

export interface ForeignSettlementPosting {
  readonly nationId: string;
  readonly direction: "OUTFLOW" | "INFLOW";
  readonly categoryId: string;
  readonly amountUnits: number;
  readonly reason: string;
}

export function foreignWarSettlementPostings(
  contract: ForeignConstructionContract,
  outcome: ForeignContractWarOutcome,
  paidAmountUnits: number,
): readonly ForeignSettlementPosting[] {
  if (FOREIGN_WAR_OUTCOME_EFFECTS[outcome].refund === "NONE") return [];
  const paid = Number.isSafeInteger(paidAmountUnits) && paidAmountUnits > 0 ? paidAmountUnits : 0;
  if (paid <= 0) return [];
  const reason = `foreign_contract_settlement:${contract.contractId}:${outcome}`;
  return [
    {
      nationId: contract.builderNationId,
      direction: "OUTFLOW",
      categoryId: FOREIGN_SETTLEMENT_CATEGORY_ID,
      amountUnits: paid,
      reason,
    },
    {
      nationId: contract.orderingNationId,
      direction: "INFLOW",
      categoryId: FOREIGN_SETTLEMENT_CATEGORY_ID,
      amountUnits: paid,
      reason,
    },
  ];
}

export function isDeliveryGuaranteeActive(contract: ForeignConstructionContract): boolean {
  return (
    typeof contract.deliveryGuaranteeClauseId === "string" &&
    contract.deliveryGuaranteeClauseId !== "" &&
    contract.deliveryGuaranteeClauseId !== FOREIGN_DELIVERY_GUARANTEE_NONE
  );
}

export interface ForeignWarPolicyInput {
  readonly contract: ForeignConstructionContract;
  readonly campaignMonth: string;
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement" | null;
  readonly tension: number;
  readonly deliveryGuaranteeActive: boolean;
  readonly physicallyImpossible: boolean;
  readonly embargo: boolean;
  readonly coBelligerent: boolean;
  readonly builderControllerHostile: boolean;
  readonly randomEngine?: RandomEngine;
  readonly randomLedger?: RandomLedger;
}

export interface ForeignWarPolicyResolution {
  readonly outcome: ForeignContractWarOutcome;
  readonly effects: ForeignWarOutcomeEffects;
  readonly reasonCode: string;
  readonly guaranteeBlockedImpoundment: boolean;
  readonly decision?: RandomDecision;
}

export function resolveForeignWarPolicy(input: ForeignWarPolicyInput): ForeignWarPolicyResolution {
  const effects = (outcome: ForeignContractWarOutcome): ForeignWarOutcomeEffects =>
    FOREIGN_WAR_OUTCOME_EFFECTS[outcome];
  const base = (
    outcome: ForeignContractWarOutcome,
    reasonCode: string,
    extra: Partial<ForeignWarPolicyResolution> = {},
  ): ForeignWarPolicyResolution => ({
    outcome,
    effects: effects(outcome),
    reasonCode,
    guaranteeBlockedImpoundment: false,
    ...extra,
  });

  if (input.physicallyImpossible)
    return base("PHYSICALLY_IMPOSSIBLE", FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE);

  if (input.embargo) return base("SUSPEND", "FOREIGN_CONTRACT_EMBARGO_SUSPENDED");

  const hostile = input.relation === "at_war" || input.builderControllerHostile === true;
  if (hostile) {
    if (input.deliveryGuaranteeActive) {
      return base("DELAY", DELIVERY_GUARANTEE_ACTIVE, { guaranteeBlockedImpoundment: true });
    }
    const probabilityBp = impoundmentProbabilityBp(input.tension);
    let draw = 0;
    let decision: RandomDecision | undefined;
    if (probabilityBp > 0 && input.randomEngine !== undefined) {
      const stream = input.randomEngine.stream(
        `${FOREIGN_IMPOUNDMENT_STREAM_FAMILY}/${input.contract.orderingNationId}/${input.contract.builderNationId}/${input.campaignMonth}`,
      );
      draw = Math.floor(stream.next() * 10_000);
      const impounded = draw < probabilityBp;
      decision = {
        streamId: FOREIGN_IMPOUNDMENT_STREAM_FAMILY,
        entityKey: input.contract.contractId,
        phase: "appropriation",
        rulesetVersion: FOREIGN_CONTRACT_WAR_POLICY_ID,
        inputHash: sha256Hex(
          canonicalSerialize({
            contractId: input.contract.contractId,
            campaignMonth: input.campaignMonth,
            tension: input.tension,
            probabilityBp,
          }),
        ),
        draw,
        outcome: impounded ? FOREIGN_IMPOUNDMENT_AUTHORIZED : FOREIGN_IMPOUNDMENT_NOT_DRAWN,
        reasonCode: impounded ? FOREIGN_IMPOUNDMENT_AUTHORIZED : FOREIGN_IMPOUNDMENT_NOT_DRAWN,
      };
      input.randomLedger?.record(decision);
    }
    return draw < probabilityBp
      ? base("IMPOUND", FOREIGN_IMPOUNDMENT_AUTHORIZED, { decision })
      : base("DELAY", FOREIGN_CONTRACT_DELIVERY_DELAYED, { decision });
  }

  if (input.relation === "allied" || input.coBelligerent === true)
    return base("CONTINUE", "FOREIGN_CONTRACT_CONTINUED");

  return base("CONTINUE", "FOREIGN_CONTRACT_WAR_UNINVOLVED");
}

export type ForeignImpoundmentResult =
  | {
      readonly ok: true;
      readonly nation: NationState;
      readonly record: ForeignContractImpoundmentRecord;
    }
  | { readonly ok: false; readonly reason: string };

export interface ForeignImpoundmentRequest {
  readonly nation: NationState;
  readonly projectId: string;
  readonly contract: ForeignConstructionContract;
  readonly resolution: ForeignWarPolicyResolution;
  readonly campaignMonth: string;
  readonly paidAmountUnits: number;
  readonly custodyNationId: string;
}

export function mergeForeignImpoundmentRecord(
  existing: readonly ForeignContractImpoundmentRecord[] | undefined,
  record: ForeignContractImpoundmentRecord,
): ForeignContractImpoundmentRecord[] {
  const merged = (existing ?? []).filter((r) => r.contractId !== record.contractId);
  merged.push(record);
  return merged.sort((a, b) =>
    a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0,
  );
}

export function authorizeForeignImpoundment(
  request: ForeignImpoundmentRequest,
): ForeignImpoundmentResult {
  if (request.resolution.outcome !== "IMPOUND")
    return { ok: false, reason: FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED };
  const project = request.nation.constructionProjects.find((p) => p["id"] === request.projectId);
  if (!project) return { ok: false, reason: "INVALID_DOCKYARD_PROJECT" };
  if (!canTransitionConstructionProject(project["status"], "IMPOUNDED"))
    return { ok: false, reason: "INVALID_DOCKYARD_PROJECT_TRANSITION" };

  const unpaidAmountUnits = Math.max(0, request.contract.totalPriceUnits - request.paidAmountUnits);
  const record: ForeignContractImpoundmentRecord = {
    contractId: request.contract.contractId,
    authorizingPredicate: `${FOREIGN_CONTRACT_WAR_POLICY_ID}:IMPOUND`,
    custodyNationId: request.custodyNationId,
    legalTitle: "ORDERING_NATION",
    paidAmountUnits: request.paidAmountUnits,
    unpaidAmountUnits,
    compensationOrForfeiture: request.paidAmountUnits > 0 ? "COMPENSATION" : "FORFEITURE",
    projectStatus: "IMPOUNDED",
    futureDeliveryEligible: false,
    month: request.campaignMonth,
  };
  const nation: NationState = {
    ...request.nation,
    constructionProjects: request.nation.constructionProjects.map((p) =>
      p["id"] === request.projectId ? ({ ...p, status: "IMPOUNDED" } as ConstructionProject) : p,
    ),
    foreignContractImpoundments: mergeForeignImpoundmentRecord(
      request.nation["foreignContractImpoundments"],
      record,
    ),
  };
  return { ok: true, nation, record };
}
