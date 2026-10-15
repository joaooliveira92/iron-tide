// DESIGN-16 sections 13.6-13.7 and 14 (spec SB3-R23; INC-10): the foreign-contract war policy, impoundment, and the
// delivery guarantee. Pure and deterministic: the only randomness is the tension-scaled discretionary-impoundment
// draw on the keyed stream family `foreign_contract/war/impoundment`, each draw recorded. No wall clock, no ambient
// input. Every outcome declares its payment, work, capacity, incomplete-hull ownership, refund and delivery effects.
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

/** DESIGN-16 section 13.6: the shipped war policy identifier stamped on every contract. */
export const FOREIGN_CONTRACT_WAR_POLICY_ID = "foreign_contract_war_policy_v1" as const;

/** DESIGN-16 section 13.6: the outcomes MUST be exactly one of these. */
export const FOREIGN_WAR_OUTCOMES = [
  "CONTINUE",
  "DELAY",
  "SUSPEND",
  "IMPOUND",
  "CANCEL_WITH_SETTLEMENT",
  "PHYSICALLY_IMPOSSIBLE",
] as const;
export type ForeignContractWarOutcome = (typeof FOREIGN_WAR_OUTCOMES)[number];

// DESIGN-16 section 18: the foreign war/impoundment reason codes.

/** DESIGN-16 sections 13.6-13.7: discretionary impoundment without a policy result. */
export const FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED =
  "FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED" as const;
/** DESIGN-16 section 14: recorded when a valid delivery guarantee prohibits a discretionary impoundment. */
export const DELIVERY_GUARANTEE_ACTIVE = "DELIVERY_GUARANTEE_ACTIVE" as const;
/** DESIGN-16 section 13.6: work cannot continue or delivery cannot occur. */
export const FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE =
  "FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE" as const;
/** DESIGN-16 section 13.6: delivery is delayed (an explicit delayed outcome). */
export const FOREIGN_CONTRACT_DELIVERY_DELAYED = "FOREIGN_CONTRACT_DELIVERY_DELAYED" as const;

// The tension-scaled discretionary-impoundment predicate (DESIGN-16 section 13.6).
//
// BALANCE TARGET: the manual states a tension-scaled impoundment *risk* but gives no formula. These are versioned
// PLACEHOLDER constants, not derived values: each tension point (0..10) contributes `1_000` bp of risk, capped at
// `9_000` bp, and no discretionary impoundment is drawn below `MIN_TENSION`. The draw is keyed and recorded.

/** The keyed stream family the discretionary-impoundment draw uses (stable; hashed). */
export const FOREIGN_IMPOUNDMENT_STREAM_FAMILY = "foreign_contract/war/impoundment" as const;
/** The shipped reason code for the impoundment draw's decision record. */
export const FOREIGN_IMPOUNDMENT_AUTHORIZED = "FOREIGN_IMPOUNDMENT_AUTHORIZED" as const;
export const FOREIGN_IMPOUNDMENT_NOT_DRAWN = "FOREIGN_IMPOUNDMENT_NOT_DRAWN" as const;
/** Tension point (0..10) → basis points of risk. */
export const FOREIGN_IMPOUNDMENT_TENSION_SLOPE_BP = 1_000 as const;
/** The maximum discretionary-impoundment probability (never certain). */
export const FOREIGN_IMPOUNDMENT_MAX_PROBABILITY_BP = 9_000 as const;
/** Below this tension, no discretionary impoundment is drawn (the parties are not hostile enough). */
export const FOREIGN_IMPOUNDMENT_MIN_TENSION = 6 as const;

/** The tension-scaled impoundment probability, floored, in basis points. Pure. */
export function impoundmentProbabilityBp(tension: number): number {
  const clamped = Number.isFinite(tension) ? Math.min(10, Math.max(0, Math.floor(tension))) : 0;
  if (clamped < FOREIGN_IMPOUNDMENT_MIN_TENSION) return 0;
  return Math.min(
    FOREIGN_IMPOUNDMENT_MAX_PROBABILITY_BP,
    clamped * FOREIGN_IMPOUNDMENT_TENSION_SLOPE_BP,
  );
}

// Outcome effects (DESIGN-16 section 13.6: every outcome MUST define these).

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

/** The shipped effect table (DESIGN-16 section 13.6). Pure data; the `CONTINUE` effects are the contract's normal run. */
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

// DESIGN-16 section 13.6/13.7: the settlement money an outcome moves

/** The versioned settlement policy the refund/compensation postings follow (no manual formula; DECISION 2026-10-12). */
export const FOREIGN_SETTLEMENT_POLICY_ID = "foreign_contract_settlement_v1" as const;
export const FOREIGN_SETTLEMENT_CATEGORY_ID = "foreign_contract_settlement" as const;

/** One balanced leg of an outcome's settlement. `direction` names whether the nation pays or is paid. */
export interface ForeignSettlementPosting {
  readonly nationId: string;
  readonly direction: "OUTFLOW" | "INFLOW";
  readonly categoryId: string;
  readonly amountUnits: number;
  readonly reason: string;
}

/**
 * DESIGN-16 sections 13.6/13.7: the money the declared outcome moves, as a balanced pair. The shipped settlement
 * (`foreign_contract_settlement_v1`, DECISION 2026-10-12): for a refund effect, the BUILDER returns to the ORDERING
 * nation the cumulative amount already paid on the abandoned/impounded contract (the ordering nation paid for work it
 * does not receive). `FORFEIT_OR_COMPENSATION` with nothing paid is a pure forfeiture — no money moves. A `NONE`
 * refund (CONTINUE/DELAY/SUSPEND) and a zero paid amount both return no postings. Pure and deterministic.
 */
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

/** DESIGN-16 section 14: a guarantee is present when the contract carries a clause other than `NONE`. */
export function isDeliveryGuaranteeActive(contract: ForeignConstructionContract): boolean {
  return (
    typeof contract.deliveryGuaranteeClauseId === "string" &&
    contract.deliveryGuaranteeClauseId !== "" &&
    contract.deliveryGuaranteeClauseId !== FOREIGN_DELIVERY_GUARANTEE_NONE
  );
}

// The war-policy resolution (DESIGN-16 section 13.6)

export interface ForeignWarPolicyInput {
  readonly contract: ForeignConstructionContract;
  readonly campaignMonth: string;
  /** The ordering↔builder diplomatic relation, or `null` when none is recorded. */
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement" | null;
  /** The ordering↔builder tension, `0..10`; drives the discretionary-impoundment predicate. */
  readonly tension: number;
  /** DESIGN-16 section 14: a valid delivery guarantee is active for this contract. */
  readonly deliveryGuaranteeActive: boolean;
  /** Occupation/destruction/route loss: work cannot continue or delivery cannot occur (section 13.6). */
  readonly physicallyImpossible: boolean;
  /** An explicit embargo predicate (section 13.6). */
  readonly embargo: boolean;
  /** Allied co-belligerents (section 13.6). */
  readonly coBelligerent: boolean;
  /** The builder's controller is a hostile party distinct from the builder (section 13.6). */
  readonly builderControllerHostile: boolean;
  readonly randomEngine?: RandomEngine;
  readonly randomLedger?: RandomLedger;
}

export interface ForeignWarPolicyResolution {
  readonly outcome: ForeignContractWarOutcome;
  readonly effects: ForeignWarOutcomeEffects;
  readonly reasonCode: string;
  /** True when a valid delivery guarantee turned a would-be discretionary `IMPOUND` into `DELAY`. */
  readonly guaranteeBlockedImpoundment: boolean;
  /** The recorded keyed draw, when the discretionary-impoundment predicate was evaluated. */
  readonly decision?: RandomDecision;
}

/**
 * DESIGN-16 section 13.6: resolve one foreign contract's fate. The order of the shipped rules is authoritative:
 *
 * 1. physical impossibility always wins (a delivery guarantee MUST NOT override it, section 14);
 * 2. an explicit embargo suspends the contract;
 * 3. enemies / a hostile builder controller: a valid delivery guarantee prohibits discretionary impoundment and the
 *    contract is delayed (delivery remains owed); otherwise the tension-scaled keyed draw decides `IMPOUND` vs `DELAY`;
 * 4. allied co-belligerents, or a war that does not involve both parties, continue.
 *
 * Pure except for the optional recorded draw. Deterministic: same inputs + seed → same outcome.
 */
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
      // DESIGN-16 section 14: a valid guarantee prohibits `IMPOUND`; delivery remains owed, so the contract is delayed.
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

// Impoundment application (DESIGN-16 section 13.7)

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
  /** The cumulative amount already paid on the contract, in treasury units. */
  readonly paidAmountUnits: number;
  /** The nation that takes custody after impoundment (the builder in the shipped rules). */
  readonly custodyNationId: string;
}

/** One impoundment record per contract; deterministic order (ascending contract id). */
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

/**
 * DESIGN-16 section 13.7: apply an authorised impoundment. Fails with `FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED`
 * when the resolution is not `IMPOUND` (discretionary impoundment without a policy result), when the project is
 * missing, or when the `IMPOUNDED` transition is illegal. On success the project is `IMPOUNDED` and one causal record
 * is appended. Pure and deterministic.
 */
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
    // Impoundment transfers custody, not legal title (DESIGN-16 section 13.7).
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
