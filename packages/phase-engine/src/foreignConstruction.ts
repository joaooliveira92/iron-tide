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
import { SafeInt, money } from "@bluewave/contracts";
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
import { researchCostLookup } from "./research.js";
import {
  committedNewConstructionMassKg,
  designNewConstructionReservedMassKg,
  foreignContractsCommittedMassKg,
  nationalConstructionCapacity,
  type NationalConstructionCapacity,
} from "./newConstructionCapacity.js";

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

export const FOREIGN_CONTRACT_FORMULA_ID = "foreign_construction_contract_v1" as const;
export const FOREIGN_CONTRACT_RULESET_VERSION = "1.0.0" as const;

export const FOREIGN_TECHNOLOGY_TRANSFER_POLICY_ID = FOREIGN_INSIGHT_POLICY_ID;
export const FOREIGN_WAR_DELAY_POLICY_ID = "foreign_contract_war_policy_v1" as const;
export const FOREIGN_IMPOUNDMENT_POLICY_ID = "foreign_contract_impoundment_v1" as const;
export const FOREIGN_OCCUPATION_DESTRUCTION_POLICY_ID =
  "foreign_contract_occupation_destruction_v1" as const;
export const FOREIGN_CANCELLATION_REFUND_POLICY_ID =
  "foreign_contract_cancellation_refund_v1" as const;
export const FOREIGN_DELIVERY_GUARANTEE_NONE = "NONE" as const;

export const FOREIGN_CONTRACT_POOL = "NEW_CONSTRUCTION" as const;

export const FOREIGN_CONTRACT_HASH_MISMATCH = "FOREIGN_CONTRACT_HASH_MISMATCH" as const;

export const FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED =
  "FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED" as const;

export const FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE = "FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE" as const;

function monthLinear(month: string): number {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return toLinear(year, m);
}

export interface ForeignContractTerms {
  readonly builderShipyardId: string;
  readonly quantity: number;
  readonly totalWorkPerUnit: number;
  readonly totalPriceUnits: number;
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
  readonly reservedMassKg: number;
  readonly builderCapabilitySnapshotHash: string;
}

export function foreignContractIdForCommand(commandId: string): string {
  return `fc-${commandId.replace(/^cmd-/, "")}`;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const nonEmpty = (s: string): boolean => typeof s === "string" && s.trim() !== "";

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
  if (new Set(c.paymentSchedule.map((i) => i.dueMonth)).size !== c.paymentSchedule.length)
    return false;
  for (const r of c.capacityReservationSchedule) {
    if (!MONTH_RE.test(r.month)) return false;
    if (!Number.isSafeInteger(r.reservedMassKg) || r.reservedMassKg < 0) return false;
    if (!nonEmpty(r.pool)) return false;
  }
  const earliestDueMonth = c.paymentSchedule
    .map((i) => i.dueMonth)
    .reduce((earliest, m) => (m < earliest ? m : earliest));
  if (earliestDueMonth > c.authorizationMonth) return false;
  return true;
}

export function foreignContractHashOf(
  c: Omit<ForeignConstructionContract, "contractHash">,
): string {
  return sha256Hex(canonicalSerialize({ artifactKind: "foreign-construction-contract", ...c }));
}

export function verifyForeignContractHash(c: ForeignConstructionContract): boolean {
  const { contractHash: _ignored, ...fields } = c;
  return foreignContractHashOf(fields) === c.contractHash;
}

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
    totalPriceUnits: money(t.totalPriceUnits),
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

export function foreignContractReservedMassKg(c: ForeignConstructionContract): number {
  return c.capacityReservationSchedule.reduce(
    (sum, r) =>
      sum + (Number.isSafeInteger(r.reservedMassKg) && r.reservedMassKg > 0 ? r.reservedMassKg : 0),
    0,
  );
}

export function foreignBuilderCommittedMassKg(
  snapshot: CampaignSnapshot,
  builderNationId: string,
  capacity: NationalConstructionCapacity,
): number {
  return (
    committedNewConstructionMassKg(snapshot, builderNationId, capacity) +
    foreignContractsCommittedMassKg(snapshot, builderNationId)
  );
}

const strCmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

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

export interface ForeignBuilderCapabilityConditions {
  readonly requiredTechnologySatisfied: boolean;
  readonly shipyardCapabilitySatisfied: boolean;
  readonly governmentPermissionSatisfied: boolean;
  readonly componentSourcingSatisfied: boolean;
  readonly physicallyCapable: boolean;
}

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

export interface ForeignConstructionOrderRequest {
  readonly nationId: string;
  readonly commandId: string;
  readonly designVersionId: string;
  readonly builderNationId: string;
  readonly month: { readonly month: number; readonly year: number };
  readonly terms?: ForeignContractTerms;
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
      readonly reservedMassKg: number;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

export function placeForeignConstructionOrder(
  snapshot: CampaignSnapshot,
  request: ForeignConstructionOrderRequest,
  content: ShipBuildingContent | undefined,
): ForeignConstructionOrderResult {
  const targets = resolveOrderTargets(snapshot, request.nationId, request.designVersionId);
  if (!targets.ok) return { ok: false, reason: targets.reason, diagnostics: targets.diagnostics };
  const { nation, design } = targets;
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
  const demand: YardDemand = {
    lengthMm: 0,
    beamMm: 0,
    displacementKg,
    heaviestKg: 0,
  };

  const dock = builderDockRecord(snapshot, request.builderNationId, content, monthIdValue);
  const balance = content?.environmentFor(
    monthIdValue,
    request.builderNationId,
  ).constructionBalance;
  const capacity =
    dock !== null && balance !== undefined
      ? nationalConstructionCapacity(balance, dock.maximumNewConstructionMassKg ?? 0)
      : null;
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
    status: "ACTIVE",
    foreignContractId: contract.contractId,
    foreignBuilderNationId: request.builderNationId,
    newConstructionReservedMassKg: 0,
  };

  const updatedNation: NationState = {
    ...nation,
    constructionProjects: [...nation["constructionProjects"], project],
    foreignContracts: [...(nation["foreignContracts"] ?? []), contract],
  };
  const acceptedNation = applyAcceptanceInsight(updatedNation, contract, snapshot);
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

function applyAcceptanceInsight(
  nation: NationState,
  contract: ForeignConstructionContract,
  snapshot: CampaignSnapshot,
): NationState {
  if (!isForeignInsightContract(contract)) return nation;
  const research = nation["research"];
  const application = applyForeignInsightMilestone({
    contract,
    milestone: "DESIGN_STUDY",
    research,
    remainingRequirementFor: makeRemainingRequirementFor(research, researchCostLookup(snapshot)),
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

export const FOREIGN_PAYMENT_CATEGORY_ID = "foreign_construction_payment" as const;

export interface ForeignPaymentPosting {
  readonly nationId: string;
  readonly direction: "OUTFLOW" | "INFLOW";
  readonly categoryId: string;
  readonly amountUnits: number;
  readonly reason: string;
}

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
  readonly balances: Readonly<Record<string, number>>;
}

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

export function foreignPaymentLedgerEntries(
  contract: ForeignConstructionContract,
  installment: ForeignContractPaymentInstallment,
  options: ForeignPaymentLedgerOptions,
): readonly LedgerTransactionInput[] {
  return foreignPostingLedgerEntries(foreignPaymentPostings(contract, installment), options);
}

export interface ForeignPaymentMonthInput {
  readonly contract: ForeignConstructionContract;
  readonly campaignMonth: string;
  readonly paidDueMonths: readonly string[];
  readonly paidThisMonth?: string;
  readonly alreadyDefaulted?: boolean;
  readonly terminated?: boolean;
}

export interface ForeignPaymentMonthOutcome {
  readonly installmentDue: boolean;
  readonly unpaidInstallment?: ForeignContractPaymentInstallment;
  readonly unpaidInstallments: readonly ForeignContractPaymentInstallment[];
  readonly unpaidAmountUnits: number;
  readonly paid: boolean;
  readonly status: ConstructionProjectStatus | undefined;
  readonly delayReasonCode: string | undefined;
  readonly zeroProgress: boolean;
  readonly postings: readonly ForeignPaymentPosting[];
}

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
    zeroProgress: true,
    postings,
  };
}

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

export const isForeignPaymentDefaultProject = (
  project: Pick<ConstructionProject, "status" | "delayReasonCode">,
): boolean =>
  project["status"] === "DELAYED" && project["delayReasonCode"] === FOREIGN_PAYMENT_DEFAULT_DELAYED;

export function applyForeignPaymentOutcome(
  project: ConstructionProject,
  outcome: ForeignPaymentMonthOutcome,
  resumeStatus: ConstructionProjectStatus = "ACTIVE",
): ConstructionProject {
  if (outcome.status !== undefined) {
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
  readonly capability: ForeignBuilderCapabilityCheck;
  readonly payment: ForeignPaymentMonthOutcome;
}

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
