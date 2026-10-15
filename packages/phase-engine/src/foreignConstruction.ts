// packages/phase-engine/src/foreignConstruction.ts
// DESIGN-16 section 13 (spec SB3-R20..R24): the foreign construction contract, the builder-capability acceptance gate,
// builder-capacity consumption, the payment schedule and its one-month grace, and the acceptance technology-insight
// milestone. The immutable contract and its hash come from section 13.1; the capability predicates from section 13.2
// (pure, in `@bluewave/ship-design`); capacity from section 13.3; payment, the grace and the
// `PAYMENT_DEFAULT_DELAYED` reason from section 13.4. Technology insight (13.5) lives in `foreignInsight.ts` and is
// awarded here at acceptance; war effects (13.6-13.7) are left to INC-10.
import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
  ConstructionProjectStatus,
  ForeignConstructionContract,
  ForeignContractPaymentInstallment,
  NationState,
} from "@bluewave/campaign";
import { canTransitionConstructionProject, monthId, toLinear } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  dockRecordFor,
  dockRecordFromDefinition,
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
  FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
  FOREIGN_BUILDER_NATION_INVALID,
  FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
  FOREIGN_PAYMENT_DEFAULT_DELAYED,
  FOREIGN_PAYMENT_GRACE_MONTHS,
  capabilityFailureCode,
  validateForeignBuilderCapability,
  type DockRecord,
  type ForeignBuilderCapabilityCheck,
  type ForeignBuilderCapabilityInput,
  type ShipBuildingContent,
  type YardDemand,
} from "@bluewave/ship-design";
import type { LedgerTransactionInput } from "./financial-ledger.js";
import { constructionProjectFor, resolveOrderTargets } from "./constructionOrder.js";
import { makeLedgerEntry } from "./events.js";
import {
  FOREIGN_INSIGHT_POLICY_ID,
  applyForeignInsightMilestone,
  isForeignInsightContract,
  makeRemainingRequirementFor,
  mergeForeignInsightAwardRecord,
} from "./foreignInsight.js";
import { researchCostOf } from "./research.js";
import {
  committedNewConstructionMassKg,
  designNewConstructionReservedMassKg,
  foreignContractsCommittedMassKg,
  nationalConstructionCapacity,
  type NationalConstructionCapacity,
} from "./newConstructionCapacity.js";

/** Re-exported so the order path has one stable, documented set of reason codes. */
export {
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
  FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
  FOREIGN_BUILDER_NATION_INVALID,
  FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
  FOREIGN_CONTRACT_PAYMENT_DEFAULT,
  FOREIGN_PAYMENT_DEFAULT_DELAYED,
  FOREIGN_PAYMENT_GRACE_MONTHS,
  capabilityFailureCode,
} from "@bluewave/ship-design";

/** DESIGN-16 section 13.1: the shipped formula/ruleset identity stamped on every contract. */
export const FOREIGN_CONTRACT_FORMULA_ID = "foreign_construction_contract_v1" as const;
export const FOREIGN_CONTRACT_RULESET_VERSION = "1.0.0" as const;

/**
 * Shipped policy identifiers; the effect modules land with INC-10 (war/impoundment) and `foreignInsight.ts`
 * (insight, section 13.5). The insight id is the canonical declaration in `foreignInsight.ts`, re-exported here so
 * the order path has one stable name.
 */
export const FOREIGN_TECHNOLOGY_TRANSFER_POLICY_ID = FOREIGN_INSIGHT_POLICY_ID;
export const FOREIGN_WAR_DELAY_POLICY_ID = "foreign_contract_war_policy_v1" as const;
export const FOREIGN_IMPOUNDMENT_POLICY_ID = "foreign_contract_impoundment_v1" as const;
export const FOREIGN_OCCUPATION_DESTRUCTION_POLICY_ID =
  "foreign_contract_occupation_destruction_v1" as const;
export const FOREIGN_CANCELLATION_REFUND_POLICY_ID =
  "foreign_contract_cancellation_refund_v1" as const;
export const FOREIGN_DELIVERY_GUARANTEE_NONE = "NONE" as const;

/** The pool a foreign reservation competes in (DESIGN-16 section 13.3). */
export const FOREIGN_CONTRACT_POOL = "NEW_CONSTRUCTION" as const;

/**
 * DESIGN-16 section 13.1: the stable reason the monthly step flags a stored contract whose `contractHash` no longer
 * matches its fields (a tampered or corrupted save). The contract is not consumed: no payment moves and no work is
 * created for it that month.
 */
export const FOREIGN_CONTRACT_HASH_MISMATCH = "FOREIGN_CONTRACT_HASH_MISMATCH" as const;

/**
 * The stable diagnostic `applyResumeConstruction` fails with when a project is held by a foreign payment default
 * (DESIGN-16 section 13.4): it cannot resume until payment clears the default.
 */
export const FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED =
  "FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED" as const;

/**
 * The stable diagnostic `applyBudgetProject` fails with when a foreign-contract project is offered a domestic budget:
 * its work is driven by the contract instalment schedule (DESIGN-16 section 13.4), so a direct budget could create
 * progress without payment.
 */
export const FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE = "FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE" as const;

// ---------------------------------------------------------------------------------------------------------------
// Month arithmetic (integer-only; no wall clock/locale)
// ---------------------------------------------------------------------------------------------------------------

function monthLinear(month: string): number {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return toLinear(year, m);
}

// ---------------------------------------------------------------------------------------------------------------
// The contract (DESIGN-16 section 13.1)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The builder terms a foreign order supplies. Everything the ordering nation and the engine can derive (ids, the
 * capability snapshot hash, the ruleset/formula versions, the contract hash) is filled in by
 * `buildForeignConstructionContract`; every policy identifier defaults to the shipped value.
 */
export interface ForeignContractTerms {
  readonly builderShipyardId: string;
  readonly quantity: number;
  readonly totalWorkPerUnit: number;
  readonly totalPriceUnits: number;
  /** Defaults to `treasury_unit`. */
  readonly currencyUnit?: string;
  readonly paymentSchedule: readonly ForeignContractPaymentInstallment[];
  readonly authorizationMonth: string;
  readonly plannedKeelMonth: string;
  readonly plannedDeliveryMonth: string;
  readonly technologyTransferPolicyId?: string;
  readonly warDelayPolicyId?: string;
  readonly impoundmentPolicyId?: string;
  readonly deliveryGuaranteeClauseId?: string;
  readonly occupationDestructionPolicyId?: string;
  readonly cancellationRefundPolicyId?: string;
  readonly governingTreatyIds?: readonly string[];
}

export interface ForeignContractBuildInput {
  readonly contractId: string;
  readonly orderingNationId: string;
  readonly builderNationId: string;
  readonly designVersionId: string;
  readonly terms: ForeignContractTerms;
  /** The mass the engine computed and reserved from the builder; the capacity schedule is derived from it. */
  readonly reservedMassKg: number;
  readonly builderCapabilitySnapshotHash: string;
}

/** The canonical contract id for an order command, mirroring the project id derivation. */
export function foreignContractIdForCommand(commandId: string): string {
  return `fc-${commandId.replace(/^cmd-/, "")}`;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const nonEmpty = (s: string): boolean => typeof s === "string" && s.trim() !== "";

/** DESIGN-16 section 13.1: a complete accepted contract, or the order is refused. Never throws. */
export function isCompleteForeignConstructionContract(c: ForeignConstructionContract): boolean {
  if (!nonEmpty(c.contractId) || !nonEmpty(c.orderingNationId) || !nonEmpty(c.builderNationId))
    return false;
  if (!nonEmpty(c.builderShipyardId) || !nonEmpty(c.designVersionId)) return false;
  if (!Number.isSafeInteger(c.quantity) || c.quantity < 1) return false;
  if (!Number.isSafeInteger(c.totalWorkPerUnit) || c.totalWorkPerUnit <= 0) return false;
  if (!Number.isSafeInteger(c.totalPriceUnits) || c.totalPriceUnits <= 0) return false;
  if (!nonEmpty(c.currencyUnit)) return false;
  if (c.paymentSchedule.length === 0 || c.capacityReservationSchedule.length === 0) return false;
  if (!MONTH_RE.test(c.authorizationMonth)) return false;
  if (!MONTH_RE.test(c.plannedKeelMonth)) return false;
  if (!MONTH_RE.test(c.plannedDeliveryMonth)) return false;
  if (!nonEmpty(c.builderCapabilitySnapshotHash)) return false;
  if (!nonEmpty(c.technologyTransferPolicyId)) return false;
  if (!nonEmpty(c.warDelayPolicyId) || !nonEmpty(c.impoundmentPolicyId)) return false;
  if (!nonEmpty(c.deliveryGuaranteeClauseId)) return false;
  if (!nonEmpty(c.occupationDestructionPolicyId) || !nonEmpty(c.cancellationRefundPolicyId))
    return false;
  if (!nonEmpty(c.rulesetVersion) || !nonEmpty(c.formulaVersion) || !nonEmpty(c.contractHash))
    return false;
  for (const i of c.paymentSchedule) {
    if (!MONTH_RE.test(i.dueMonth)) return false;
    if (!Number.isSafeInteger(i.amountUnits) || i.amountUnits < 0) return false;
    if (!Number.isSafeInteger(i.workShareBp) || i.workShareBp < 0 || i.workShareBp > 10_000)
      return false;
  }
  // INC-9e MINOR-4: duplicate due months would collapse the `paidDueMonths` key, letting a partial budget underpay
  // while unlocking full work. A complete contract has at most one instalment per due month.
  if (new Set(c.paymentSchedule.map((i) => i.dueMonth)).size !== c.paymentSchedule.length)
    return false;
  for (const r of c.capacityReservationSchedule) {
    if (!MONTH_RE.test(r.month)) return false;
    if (!Number.isSafeInteger(r.reservedMassKg) || r.reservedMassKg < 0) return false;
    if (!nonEmpty(r.pool)) return false;
  }
  // DESIGN-16 section 13.4 (MEDIUM-5): the first instalment must be due no later than the authorization month, else
  // the project would have a free-work window before any payment is ever owed. All due months are already validated
  // above, so a lexicographic `YYYY-MM` comparison is a safe earliest check.
  const earliestDueMonth = c.paymentSchedule
    .map((i) => i.dueMonth)
    .reduce((earliest, m) => (m < earliest ? m : earliest));
  if (earliestDueMonth > c.authorizationMonth) return false;
  return true;
}

/** The canonical hash over every contract field except `contractHash` itself. Deterministic. */
export function foreignContractHashOf(
  c: Omit<ForeignConstructionContract, "contractHash">,
): string {
  return sha256Hex(canonicalSerialize({ artifactKind: "foreign-construction-contract", ...c }));
}

/** Whether a contract's stored hash matches its fields (a tampered contract is rejected at load/order time). */
export function verifyForeignContractHash(c: ForeignConstructionContract): boolean {
  const { contractHash: _ignored, ...fields } = c;
  return foreignContractHashOf(fields) === c.contractHash;
}

/** DESIGN-16 section 13.1: build the one immutable contract for a foreign order, computing its hash. Pure. */
export function buildForeignConstructionContract(
  input: ForeignContractBuildInput,
): ForeignConstructionContract {
  const t = input.terms;
  const fields: Omit<ForeignConstructionContract, "contractHash"> = {
    contractId: input.contractId,
    orderingNationId: input.orderingNationId,
    builderNationId: input.builderNationId,
    builderShipyardId: t.builderShipyardId,
    designVersionId: input.designVersionId,
    quantity: t.quantity,
    totalWorkPerUnit: t.totalWorkPerUnit,
    totalPriceUnits: t.totalPriceUnits,
    currencyUnit: t.currencyUnit ?? "treasury_unit",
    paymentSchedule: t.paymentSchedule.map((i) => ({ ...i })),
    capacityReservationSchedule: [
      {
        month: t.authorizationMonth,
        reservedMassKg: Number.isSafeInteger(input.reservedMassKg) ? input.reservedMassKg : 0,
        pool: FOREIGN_CONTRACT_POOL,
      },
    ],
    authorizationMonth: t.authorizationMonth,
    plannedKeelMonth: t.plannedKeelMonth,
    plannedDeliveryMonth: t.plannedDeliveryMonth,
    builderCapabilitySnapshotHash: input.builderCapabilitySnapshotHash,
    technologyTransferPolicyId:
      t.technologyTransferPolicyId ?? FOREIGN_TECHNOLOGY_TRANSFER_POLICY_ID,
    warDelayPolicyId: t.warDelayPolicyId ?? FOREIGN_WAR_DELAY_POLICY_ID,
    impoundmentPolicyId: t.impoundmentPolicyId ?? FOREIGN_IMPOUNDMENT_POLICY_ID,
    deliveryGuaranteeClauseId: t.deliveryGuaranteeClauseId ?? FOREIGN_DELIVERY_GUARANTEE_NONE,
    occupationDestructionPolicyId:
      t.occupationDestructionPolicyId ?? FOREIGN_OCCUPATION_DESTRUCTION_POLICY_ID,
    cancellationRefundPolicyId:
      t.cancellationRefundPolicyId ?? FOREIGN_CANCELLATION_REFUND_POLICY_ID,
    governingTreatyIds: [...(t.governingTreatyIds ?? [])],
    rulesetVersion: FOREIGN_CONTRACT_RULESET_VERSION,
    formulaVersion: FOREIGN_CONTRACT_FORMULA_ID,
  };
  return { ...fields, contractHash: foreignContractHashOf(fields) };
}

/** The whole capacity a contract reserves from its builder, the sum of its reservation schedule. */
export function foreignContractReservedMassKg(c: ForeignConstructionContract): number {
  return c.capacityReservationSchedule.reduce(
    (sum, r) =>
      sum + (Number.isSafeInteger(r.reservedMassKg) && r.reservedMassKg > 0 ? r.reservedMassKg : 0),
    0,
  );
}

/**
 * DESIGN-16 section 13.3: the builder's total committed `NEW_CONSTRUCTION` mass — its own in-flight domestic work
 * PLUS every foreign contract placed with it by any nation. A builder must not sell the same capacity twice: a new
 * foreign reservation is admitted only when it fits the remainder of the builder's cap.
 */
export function foreignBuilderCommittedMassKg(
  snapshot: CampaignSnapshot,
  builderNationId: string,
  capacity: NationalConstructionCapacity,
): number {
  // `foreignContractsCommittedMassKg` counts only LIVE accepted contracts (a completed/cancelled contract releases the
  // builder's capacity), so a lingering terminal contract never inflates the committed mass on either path.
  return (
    committedNewConstructionMassKg(snapshot, builderNationId, capacity) +
    foreignContractsCommittedMassKg(snapshot, builderNationId)
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Deterministic ordering (DESIGN-16 section 13.3)
// ---------------------------------------------------------------------------------------------------------------

const strCmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Foreign contracts are ordered by builder nation, then builder shipyard, then authorization month, then contract id.
 * Database/insertion order can never change a result.
 */
export function compareForeignConstructionContracts(
  a: ForeignConstructionContract,
  b: ForeignConstructionContract,
): number {
  return (
    strCmp(a.builderNationId, b.builderNationId) ||
    strCmp(a.builderShipyardId, b.builderShipyardId) ||
    strCmp(a.authorizationMonth, b.authorizationMonth) ||
    strCmp(a.contractId, b.contractId)
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Builder capability (DESIGN-16 section 13.2)
// ---------------------------------------------------------------------------------------------------------------

/** The caller-resolved boolean predicates for the builder (section 13.2), excluding the derived dock/capacity. */
export interface ForeignBuilderCapabilityConditions {
  readonly requiredTechnologySatisfied: boolean;
  readonly shipyardCapabilitySatisfied: boolean;
  readonly governmentPermissionSatisfied: boolean;
  readonly componentSourcingSatisfied: boolean;
  readonly physicallyCapable: boolean;
}

/** The builder's dock, materialised on its nation or resolved from its naval profile; `null` when neither exists. */
export function builderDockRecord(
  snapshot: CampaignSnapshot,
  builderNationId: string,
  content: ShipBuildingContent | undefined,
  month: string,
): Partial<DockRecord> | null {
  const materialised = snapshot["nations"].get(builderNationId)?.dock;
  if (materialised !== undefined) return dockRecordFromDefinition(materialised);
  const profile = content?.navalProfileFor(builderNationId, month) ?? null;
  return profile !== null ? dockRecordFor(profile) : null;
}

/** The canonical hash of the capability snapshot a contract is accepted against (DESIGN-16 section 13.1). */
export function foreignBuilderCapabilitySnapshotHash(input: ForeignBuilderCapabilityInput): string {
  return sha256Hex(
    canonicalSerialize({
      artifactKind: "foreign-builder-capability",
      demand: input.demand,
      dock: input.dock,
      requiredTechnologySatisfied: input.requiredTechnologySatisfied,
      shipyardCapabilitySatisfied: input.shipyardCapabilitySatisfied,
      governmentPermissionSatisfied: input.governmentPermissionSatisfied,
      componentSourcingSatisfied: input.componentSourcingSatisfied,
      physicallyCapable: input.physicallyCapable,
      reservedMassKg: input.reservedMassKg,
      availableNewConstructionCapacityKg: input.availableNewConstructionCapacityKg,
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Ordering abroad (DESIGN-16 sections 13.1-13.3)
// ---------------------------------------------------------------------------------------------------------------

export interface ForeignConstructionOrderRequest {
  /** The ordering nation (it pays, and owns the project record). */
  readonly nationId: string;
  readonly commandId: string;
  readonly designVersionId: string;
  readonly builderNationId: string;
  readonly month: { readonly month: number; readonly year: number };
  /** The contract terms; absent means no complete contract can be formed (FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED). */
  readonly terms?: ForeignContractTerms;
  /** The builder's resolved predicates; absent means capability cannot be established. */
  readonly capability?: ForeignBuilderCapabilityConditions;
}

export type ForeignConstructionOrderResult =
  | {
      readonly ok: true;
      readonly snapshot: CampaignSnapshot;
      readonly project: ConstructionProject;
      readonly contract: ForeignConstructionContract;
      readonly design: CompiledDesignVersion;
      readonly capability: ForeignBuilderCapabilityCheck;
      /** The mass the contract reserves from the BUILDER (never the ordering nation). */
      readonly reservedMassKg: number;
    }
  | {
      readonly ok: false;
      /** `NATION_NOT_FOUND`, `UNKNOWN_DESIGN`, `DESIGN_NOT_FOR_PLAYER`, or a foreign reason code. */
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

/**
 * The one way a foreign construction project enters a snapshot (DESIGN-16 section 13). It validates the design, forms
 * and checks the complete contract, checks every builder-capability predicate against the BUILDER's dock and free
 * `NEW_CONSTRUCTION` capacity, and only then records the contract on the ordering nation and the project (whose stored
 * reservation is `0`) on the ordering nation. The ordering nation's concurrency pool is therefore untouched; the
 * builder's pool is consumed through the stored contract. Platform-independent and deterministic.
 */
export function placeForeignConstructionOrder(
  snapshot: CampaignSnapshot,
  request: ForeignConstructionOrderRequest,
  content: ShipBuildingContent | undefined,
): ForeignConstructionOrderResult {
  const targets = resolveOrderTargets(snapshot, request.nationId, request.designVersionId);
  if (!targets.ok) return { ok: false, reason: targets.reason, diagnostics: targets.diagnostics };
  const { nation, design } = targets;
  // DESIGN-16 sections 13.1/13.4: a builder that is not a distinct nation of the campaign would let an instalment
  // debit the ordering treasury without crediting a real yard (destroying money), or have the ordering nation pay
  // itself. Refuse the order at the boundary rather than persist such a contract.
  if (
    request.builderNationId === request.nationId ||
    !snapshot["nations"].has(request.builderNationId)
  )
    return {
      ok: false,
      reason: FOREIGN_BUILDER_NATION_INVALID,
      diagnostics: [
        `Builder ${request.builderNationId} for command ${request.commandId} is not a distinct nation in the campaign`,
      ],
    };
  if (request.terms === undefined)
    return {
      ok: false,
      reason: FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
      diagnostics: [
        "A foreign order requires a complete ForeignConstructionContract (DESIGN-16 section 13.1).",
      ],
    };
  if (request.capability === undefined)
    return {
      ok: false,
      reason: FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
      diagnostics: [
        "No builder capability was supplied for the foreign order (DESIGN-16 section 13.2).",
      ],
    };

  const monthIdValue = monthId(request.month.year, request.month.month);
  const displacementKg = Number(design.normalizedDisplacementKg);
  // INC-16: `CompiledDesignVersion` carries no length/beam, so the builder's dock dimension predicate is inert (only
  // the mass/displacement ceiling is judged). Recorded deferral owned by ship-design/campaign content.
  const demand: YardDemand = {
    lengthMm: 0,
    beamMm: 0,
    displacementKg,
    heaviestKg: 0,
  };

  // Resolve the BUILDER's dock and free NEW_CONSTRUCTION capacity. A builder with neither a materialised dock nor a
  // naval profile fails the DOCK predicate (an empty record is missing every limit).
  const dock = builderDockRecord(snapshot, request.builderNationId, content, monthIdValue);
  const balance = content?.environmentFor(
    monthIdValue,
    request.builderNationId,
  ).constructionBalance;
  const capacity =
    dock !== null && balance !== undefined
      ? nationalConstructionCapacity(balance, dock.maximumNewConstructionMassKg ?? 0)
      : null;
  // DESIGN-16 section 13.2 (Med1): a builder whose free construction capacity cannot be resolved cannot accept a
  // reservation. Refuse with a specific CAPACITY reason rather than silently reserving 0 kg, which would let any hull
  // through the capability gate.
  if (dock !== null && capacity === null)
    return {
      ok: false,
      reason: FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
      diagnostics: [
        "CAPACITY: The builder's construction balance could not be resolved, so no NEW_CONSTRUCTION capacity is available.",
      ],
    };
  const reservedPerUnit =
    capacity !== null
      ? designNewConstructionReservedMassKg(design.hullType, displacementKg, capacity)
      : 0;
  const reservedMassKg = reservedPerUnit * request.terms.quantity;
  const committed =
    capacity !== null
      ? foreignBuilderCommittedMassKg(snapshot, request.builderNationId, capacity)
      : 0;
  const availableNewConstructionCapacityKg =
    capacity !== null ? Math.max(0, capacity.maxConcurrentMassKg - committed) : 0;

  const capabilityInput: ForeignBuilderCapabilityInput = {
    demand,
    dock: dock ?? {},
    requiredTechnologySatisfied: request.capability.requiredTechnologySatisfied,
    shipyardCapabilitySatisfied: request.capability.shipyardCapabilitySatisfied,
    governmentPermissionSatisfied: request.capability.governmentPermissionSatisfied,
    componentSourcingSatisfied: request.capability.componentSourcingSatisfied,
    physicallyCapable: request.capability.physicallyCapable,
    reservedMassKg,
    availableNewConstructionCapacityKg,
  };

  // DESIGN-16 section 13.1: form the contract first and refuse an incomplete one before judging capability, so an order
  // that cannot produce a complete accepted contract always fails with FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED.
  const contract = buildForeignConstructionContract({
    contractId: foreignContractIdForCommand(request.commandId),
    orderingNationId: request.nationId,
    builderNationId: request.builderNationId,
    designVersionId: request.designVersionId,
    terms: request.terms,
    reservedMassKg,
    builderCapabilitySnapshotHash: foreignBuilderCapabilitySnapshotHash(capabilityInput),
  });
  if (!isCompleteForeignConstructionContract(contract))
    return {
      ok: false,
      reason: FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
      diagnostics: [`The foreign contract for command ${request.commandId} is incomplete.`],
    };

  const capability = validateForeignBuilderCapability(capabilityInput);
  if (!capability.satisfied)
    return {
      ok: false,
      reason: capabilityFailureCode(capability),
      diagnostics: capability.reasons.map((r) => `${r.field}: ${r.message}`),
    };

  const project: ConstructionProject = {
    ...constructionProjectFor(
      request.commandId,
      request.designVersionId,
      contract.totalWorkPerUnit * contract.quantity,
      request.month,
      design["constructionPlan"],
    ),
    // DESIGN-16 section 13.2: the accepted contract has passed the builder-capability gate, so the order is live (it
    // can be delayed by a payment default). Starting ACTIVE also makes the legal `ACTIVE -> DELAYED` edge available.
    status: "ACTIVE",
    foreignContractId: contract.contractId,
    foreignBuilderNationId: request.builderNationId,
    // The ordering nation's pool is provably untouched: its stored reservation is zero. The builder's capacity is
    // consumed through the contract's reservation schedule (section 13.3).
    newConstructionReservedMassKg: 0,
  };

  const updatedNation: NationState = {
    ...nation,
    constructionProjects: [...nation["constructionProjects"], project],
    foreignContracts: [...(nation["foreignContracts"] ?? []), contract],
  };
  // DESIGN-16 section 13.5 (SB3-R24): award the design-study insight at acceptance, when the contract selects the
  // insight policy and the ordering nation still lacks the family's technology. It posts micro-points into the
  // existing research model and never grants a technology. The award record is absent until the first award.
  const acceptedNation = applyAcceptanceInsight(updatedNation, contract);
  const nations = new Map(snapshot["nations"]).set(request.nationId, acceptedNation);
  return {
    ok: true,
    snapshot: { ...snapshot, nations },
    project,
    contract,
    design,
    capability,
    reservedMassKg,
  };
}

/**
 * DESIGN-16 section 13.5: apply the acceptance (design-study) insight to a nation that has just accepted a foreign
 * contract. Returns the nation unchanged when the contract does not select the policy or no award is due, so a
 * foreign order that transfers no insight is byte-identical to the INC-9 result. Pure.
 */
function applyAcceptanceInsight(
  nation: NationState,
  contract: ForeignConstructionContract,
): NationState {
  if (!isForeignInsightContract(contract)) return nation;
  const research = nation["research"];
  const application = applyForeignInsightMilestone({
    contract,
    milestone: "DESIGN_STUDY",
    research,
    remainingRequirementFor: makeRemainingRequirementFor(research, researchCostOf),
  });
  if (application.awards.length === 0) return nation;
  const foreignInsightAwards = mergeForeignInsightAwardRecord(
    nation["foreignInsightAwards"],
    application.record,
  );
  return {
    ...nation,
    research: application.research,
    ...(foreignInsightAwards === undefined ? {} : { foreignInsightAwards }),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Payment schedule + grace (DESIGN-16 section 13.4)
// ---------------------------------------------------------------------------------------------------------------

export const FOREIGN_PAYMENT_CATEGORY_ID = "foreign_construction_payment" as const;

/** One balanced ledger leg of a contract payment. `OUTFLOW` is the ordering nation, `INFLOW` the builder. */
export interface ForeignPaymentPosting {
  readonly nationId: string;
  readonly direction: "OUTFLOW" | "INFLOW";
  readonly categoryId: string;
  readonly amountUnits: number;
  readonly reason: string;
}

/** DESIGN-16 section 13.4: the balanced posting pair for one paid instalment (payer out, builder in). */
export function foreignPaymentPostings(
  contract: ForeignConstructionContract,
  installment: ForeignContractPaymentInstallment,
): readonly ForeignPaymentPosting[] {
  const amount =
    Number.isSafeInteger(installment.amountUnits) && installment.amountUnits > 0
      ? installment.amountUnits
      : 0;
  const reason = `foreign_construction_payment:${contract.contractId}:${installment.dueMonth}`;
  return [
    {
      nationId: contract.orderingNationId,
      direction: "OUTFLOW",
      categoryId: FOREIGN_PAYMENT_CATEGORY_ID,
      amountUnits: amount,
      reason,
    },
    {
      nationId: contract.builderNationId,
      direction: "INFLOW",
      categoryId: FOREIGN_PAYMENT_CATEGORY_ID,
      amountUnits: amount,
      reason,
    },
  ];
}

export interface ForeignPaymentLedgerOptions {
  readonly campaignMonth: string;
  readonly phaseId: string;
  /** Treasury balance per nation before the payment; absent nations start from `0`. */
  readonly balances: Readonly<Record<string, number>>;
}

/**
 * DESIGN-16 section 13.4/13.6: the balanced `FinancialLedger` entries for a posting pair. Each leg is internally
 * balanced (`debit === credit`), so the invariant the ledger enforces holds; the direction is carried in the posting.
 */
export function foreignPostingLedgerEntries(
  postings: readonly ForeignPaymentPosting[],
  options: ForeignPaymentLedgerOptions,
): readonly LedgerTransactionInput[] {
  const balances = options.balances;
  return postings.map((posting) => {
    const rawPrevious = balances[posting.nationId];
    const previous = Number.isSafeInteger(rawPrevious) ? (rawPrevious as number) : 0;
    const delta = posting.direction === "OUTFLOW" ? -posting.amountUnits : posting.amountUnits;
    const next = previous + delta;
    return makeLedgerEntry(
      posting.nationId,
      options.phaseId,
      posting.categoryId,
      SafeInt(posting.amountUnits),
      SafeInt(posting.amountUnits),
      SafeInt(previous),
      SafeInt(next),
      posting.reason,
      options.campaignMonth,
    );
  });
}

/**
 * DESIGN-16 section 13.4: the balanced `FinancialLedger` entries for one paid instalment. Each leg is internally
 * balanced (`debit === credit`), so the invariant the ledger enforces holds; the direction is carried in the posting.
 */
export function foreignPaymentLedgerEntries(
  contract: ForeignConstructionContract,
  installment: ForeignContractPaymentInstallment,
  options: ForeignPaymentLedgerOptions,
): readonly LedgerTransactionInput[] {
  return foreignPostingLedgerEntries(foreignPaymentPostings(contract, installment), options);
}

export interface ForeignPaymentMonthInput {
  readonly contract: ForeignConstructionContract;
  /** The campaign month being resolved (`YYYY-MM`). */
  readonly campaignMonth: string;
  /** Due months already paid as of `campaignMonth` (any order; matched exactly). */
  readonly paidDueMonths: readonly string[];
  /** The due month paid in `campaignMonth`, for the ledger postings. */
  readonly paidThisMonth?: string;
  /** True when an earlier unpaid instalment's grace has already expired. */
  readonly alreadyDefaulted?: boolean;
  /** True when the contract has been terminated; no postings and no default. */
  readonly terminated?: boolean;
}

export interface ForeignPaymentMonthOutcome {
  /** True when at least one instalment is due at or before `campaignMonth`. */
  readonly installmentDue: boolean;
  /** The earliest unpaid due instalment, when there is one. */
  readonly unpaidInstallment?: ForeignContractPaymentInstallment;
  /** Every unpaid due instalment, ascending by due month (what a caller settles, and why work is zero). */
  readonly unpaidInstallments: readonly ForeignContractPaymentInstallment[];
  readonly unpaidAmountUnits: number;
  /** Whether all due instalments are paid. */
  readonly paid: boolean;
  /** The project status to hold: `DELAYED` after the grace expires, else `undefined` (no change). */
  readonly status: ConstructionProjectStatus | undefined;
  /** `PAYMENT_DEFAULT_DELAYED` when `status` is `DELAYED`, else `undefined`. */
  readonly delayReasonCode: string | undefined;
  /** DESIGN-16 section 13.4: unpaid work receives zero progress. */
  readonly zeroProgress: boolean;
  /** Balanced postings for the instalment paid this month (empty when nothing was paid). */
  readonly postings: readonly ForeignPaymentPosting[];
}

/**
 * DESIGN-16 section 13.4: resolve one contract-month's payment. Every due instalment that is unpaid makes work zero.
 * An unpaid instalment becomes a payment default only AFTER the shipped one-month grace has elapsed
 * (`campaignMonth - dueMonth > FOREIGN_PAYMENT_GRACE_MONTHS`), or once default has already been recorded; a payment on
 * the grace month therefore clears it. Pure and deterministic.
 */
export function resolveForeignPaymentMonth(
  input: ForeignPaymentMonthInput,
): ForeignPaymentMonthOutcome {
  const { contract, campaignMonth } = input;
  if (input.terminated)
    return {
      installmentDue: false,
      unpaidInstallments: [],
      unpaidAmountUnits: 0,
      paid: true,
      status: undefined,
      delayReasonCode: undefined,
      zeroProgress: false,
      postings: [],
    };

  const paid = new Set(input.paidDueMonths);
  if (input.paidThisMonth !== undefined) paid.add(input.paidThisMonth);
  const current = monthLinear(campaignMonth);
  const due = contract.paymentSchedule
    .filter((i) => MONTH_RE.test(i.dueMonth) && monthLinear(i.dueMonth) <= current)
    .sort((a, b) => monthLinear(a.dueMonth) - monthLinear(b.dueMonth));
  const unpaid = due.filter((i) => !paid.has(i.dueMonth));

  const paidInstallment =
    input.paidThisMonth !== undefined
      ? contract.paymentSchedule.find((i) => i.dueMonth === input.paidThisMonth)
      : undefined;
  const postings =
    paidInstallment !== undefined ? foreignPaymentPostings(contract, paidInstallment) : [];

  if (unpaid.length === 0)
    return {
      installmentDue: due.length > 0,
      unpaidInstallments: [],
      unpaidAmountUnits: 0,
      paid: true,
      status: undefined,
      delayReasonCode: undefined,
      zeroProgress: false,
      postings,
    };

  const graceExpired = unpaid.some(
    (i) => current - monthLinear(i.dueMonth) > FOREIGN_PAYMENT_GRACE_MONTHS,
  );
  const defaulted = input.alreadyDefaulted === true || graceExpired;
  const unpaidAmountUnits = unpaid.reduce(
    (sum, i) => sum + (Number.isSafeInteger(i.amountUnits) ? i.amountUnits : 0),
    0,
  );
  return {
    installmentDue: true,
    unpaidInstallment: unpaid[0]!,
    unpaidInstallments: unpaid,
    unpaidAmountUnits,
    paid: false,
    status: defaulted ? "DELAYED" : undefined,
    delayReasonCode: defaulted ? FOREIGN_PAYMENT_DEFAULT_DELAYED : undefined,
    // Unpaid work receives zero progress from the moment an instalment is unpaid.
    zeroProgress: true,
    postings,
  };
}

/**
 * DESIGN-16 section 13.4 (INC-9d decision): the cumulative work a contract has PAID for, in project work units. Each
 * paid instalment unlocks its `workShareBp` share of the project's total work; the shares are summed, clamped to
 * `10_000` bp, and floored. Work on a foreign project is funded solely by its schedule — the ordering nation is
 * charged only the instalments, never an ordinary construction charge for the same work. Unpaid work therefore
 * receives zero progress. Pure and deterministic.
 */
export function foreignUnlockedWork(
  totalWork: number,
  contract: ForeignConstructionContract,
  paidDueMonths: readonly string[],
): number {
  if (!Number.isSafeInteger(totalWork) || totalWork <= 0) return 0;
  const paid = new Set(paidDueMonths);
  let paidShareBp = 0;
  for (const i of contract.paymentSchedule)
    if (paid.has(i.dueMonth) && Number.isSafeInteger(i.workShareBp) && i.workShareBp > 0)
      paidShareBp += i.workShareBp;
  const cappedBp = Math.min(10_000, paidShareBp);
  return Math.floor((totalWork * cappedBp) / 10_000);
}

/** Whether a project is held by a foreign payment default (the reason that must not be auto-resumed). */
export const isForeignPaymentDefaultProject = (
  project: Pick<ConstructionProject, "status" | "delayReasonCode">,
): boolean =>
  project["status"] === "DELAYED" && project["delayReasonCode"] === FOREIGN_PAYMENT_DEFAULT_DELAYED;

/**
 * Apply a payment-month outcome to a project (DESIGN-16 section 13.4).
 *
 * - A defaulting outcome (`status: DELAYED`) moves the project to `DELAYED` when the transition is legal and records
 *   the reason; a project with no legal `DELAYED` edge keeps its status (so the caller can act once it is authorized).
 * - A paid/terminated outcome (`status: undefined`) that finds the project held by a foreign payment default clears
 *   `delayReasonCode` and resumes it to `resumeStatus` — the caller's `constructionResumeTarget` (`ACTIVE`, or
 *   `AWAITING_CAPACITY` when the design records no usable capacity). The day the default clears the project is live
 *   again, so an ordinary month can fund it.
 * - Any other outcome leaves the project unchanged.
 *
 * Pure and deterministic.
 */
export function applyForeignPaymentOutcome(
  project: ConstructionProject,
  outcome: ForeignPaymentMonthOutcome,
  resumeStatus: ConstructionProjectStatus = "ACTIVE",
): ConstructionProject {
  if (outcome.status !== undefined) {
    // MINOR-8: never write a delay reason unless the project actually moved to `DELAYED`. An illegal transition (e.g.
    // a terminal project) leaves the project byte-identical, so the "reason only on a delayed month" invariant holds.
    if (!canTransitionConstructionProject(project["status"], outcome.status)) return project;
    const moved: ConstructionProject = { ...project, status: outcome.status };
    return outcome.delayReasonCode !== undefined && moved["status"] === "DELAYED"
      ? { ...moved, delayReasonCode: outcome.delayReasonCode }
      : moved;
  }
  if (!isForeignPaymentDefaultProject(project)) return project;
  const resumed = canTransitionConstructionProject(project["status"], resumeStatus)
    ? { ...project, status: resumeStatus }
    : project;
  const cleared: ConstructionProject = { ...resumed };
  delete cleared.delayReasonCode;
  return cleared;
}

// ---------------------------------------------------------------------------------------------------------------
// Monthly revalidation seam (DESIGN-16 section 13.2)
// ---------------------------------------------------------------------------------------------------------------

export interface ForeignContractMonthInput {
  readonly contract: ForeignConstructionContract;
  readonly campaignMonth: string;
  readonly demand: YardDemand;
  readonly dock: Partial<DockRecord>;
  readonly conditions: ForeignBuilderCapabilityConditions;
  readonly reservedMassKg: number;
  readonly availableNewConstructionCapacityKg: number;
  readonly paidDueMonths: readonly string[];
  readonly paidThisMonth?: string;
  readonly alreadyDefaulted?: boolean;
  readonly terminated?: boolean;
}

export interface ForeignContractMonthOutcome {
  /** Capability revalidated for volatile conditions. A failure is an explicit delayed/impossible outcome. */
  readonly capability: ForeignBuilderCapabilityCheck;
  readonly payment: ForeignPaymentMonthOutcome;
}

/**
 * The monthly foreign-contract step (DESIGN-16 sections 13.2/13.4): revalidate the builder's capability against the
 * current snapshot and resolve the month's payment. Pure; the monthly phase owns applying the outcome. A capability
 * failure is returned for the caller to map to the contract's explicit delayed/impossible outcome; it is never a
 * silent design downgrade.
 */
export function advanceForeignContractMonth(
  input: ForeignContractMonthInput,
): ForeignContractMonthOutcome {
  const capability = validateForeignBuilderCapability({
    demand: input.demand,
    dock: input.dock,
    requiredTechnologySatisfied: input.conditions.requiredTechnologySatisfied,
    shipyardCapabilitySatisfied: input.conditions.shipyardCapabilitySatisfied,
    governmentPermissionSatisfied: input.conditions.governmentPermissionSatisfied,
    componentSourcingSatisfied: input.conditions.componentSourcingSatisfied,
    physicallyCapable: input.conditions.physicallyCapable,
    reservedMassKg: input.reservedMassKg,
    availableNewConstructionCapacityKg: input.availableNewConstructionCapacityKg,
  });
  const payment = resolveForeignPaymentMonth({
    contract: input.contract,
    campaignMonth: input.campaignMonth,
    paidDueMonths: input.paidDueMonths,
    paidThisMonth: input.paidThisMonth,
    alreadyDefaulted: input.alreadyDefaulted,
    terminated: input.terminated,
  });
  return { capability, payment };
}
