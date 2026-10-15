// SB3-R20/R23/R34 (INC-9b): the read-only foreign-order preview. It resolves, for a given compiled design and
// quantity, every candidate builder nation — its dock ceiling, its free NEW_CONSTRUCTION capacity, the §13.2
// capability verdict, the tension-scaled impoundment risk and the delivery-guarantee status — and, for a chosen
// builder, the contract terms the order would form. Pure and deterministic: the derivation mirrors the order path
// (`applyOrderForeignConstruction` + `placeForeignConstructionOrder`) exactly, so the dialog can never disagree with
// the engine. It mutates nothing and reserves nothing.
import type { CampaignSnapshot, ForeignContractPaymentInstallment } from "@bluewave/campaign";
import {
  capabilityFailureCode,
  validateForeignBuilderCapability,
  type ShipBuildingContent,
  type YardDemand,
} from "@bluewave/ship-design";
import {
  CONSTRUCTION_BATCH_MAX_QUANTITY,
  CONSTRUCTION_BATCH_MIN_QUANTITY,
  resolveOrderTargets,
} from "./constructionOrder.js";
import { builderDockRecord, foreignBuilderCommittedMassKg } from "./foreignConstruction.js";
import {
  FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
  FOREIGN_CONTRACT_POOL,
  FOREIGN_PAYMENT_GRACE_MONTHS,
} from "./foreignConstruction.js";
import {
  FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
  deriveForeignContractTerms,
  relationAndTension,
  resolveBuilderConstructionSupply,
  resolveForeignBuilderCapability,
  type ForeignContractTermsInput,
} from "./foreignTerms.js";
import { impoundmentProbabilityBp } from "./foreignWarEffects.js";
import {
  designNewConstructionReservedMassKg,
  nationalConstructionCapacity,
} from "./newConstructionCapacity.js";

/** One reserved-capacity month of the contract's schedule (DESIGN-16 section 13.1/13.3). */
export interface ForeignCapacityReservationPreview {
  readonly month: string;
  readonly reservedMassKg: number;
  readonly pool: string;
}

/** One candidate builder the foreign-order dialog may offer (SB3-R20/R23/R34). Every field is derived, never authored. */
export interface ForeignBuilderCandidate {
  readonly nationId: string;
  readonly name: string;
  readonly tag: string;
  /** The ordering↔builder relation, or `null` when none is recorded. */
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement" | null;
  /** The ordering↔builder tension (`0..10`). */
  readonly tension: number;
  /** The builder's dock ceiling for new construction, kg; `null` when no dock record resolves. */
  readonly dockCeilingKg: number | null;
  /** The mass this order would reserve against the builder's `NEW_CONSTRUCTION` cap, kg. */
  readonly reservedMassKg: number;
  /** Free builder `NEW_CONSTRUCTION` capacity for a new foreign contract, kg. */
  readonly availableNewConstructionMassKg: number;
  /** True when the design's displacement is within the builder's dock ceiling. */
  readonly fitsDock: boolean;
  /** True when every §13.2 capability predicate holds for this design and quantity. */
  readonly capabilitySatisfied: boolean;
  /** Field-tagged capability failures (`DOCK: …`), in the engine's fixed order; empty when satisfied. */
  readonly capabilityReasons: readonly string[];
  /** The stable reason code an order to this builder would fail with, or `null` when it would be accepted. */
  readonly capabilityFailureCode: string | null;
  /** The tension-scaled discretionary-impoundment probability, bp; `0` unless the parties are at war. */
  readonly impoundmentRiskBp: number;
  /** Whether a delivery guarantee is active for this contract (§14); always false until a treaty/clause source exists. */
  readonly deliveryGuarantee: boolean;
}

/** The contract terms an order to one builder would form (SB3-R20/R22), with the capability verdict. */
export interface ForeignContractTermsPreview {
  readonly quantity: number;
  readonly totalWorkPerUnit: number;
  readonly totalPriceUnits: number;
  readonly paymentSchedule: readonly ForeignContractPaymentInstallment[];
  /** The builder-capacity reservation schedule the contract would carry (DESIGN-16 section 13.3). */
  readonly capacityReservationSchedule: readonly ForeignCapacityReservationPreview[];
  /** The shipped payment grace, in months, after each due instalment (DESIGN-16 section 13.4). */
  readonly paymentGraceMonths: number;
  readonly plannedKeelMonth: string;
  readonly plannedDeliveryMonth: string;
  /** The mass the contract reserves from the builder, kg. */
  readonly reservedMassKg: number;
  readonly capabilitySatisfied: boolean;
  readonly capabilityReasons: readonly string[];
  readonly capabilityFailureCode: string | null;
}

export interface ForeignConstructionPreview {
  readonly designVersionId: string;
  readonly quantity: number;
  readonly designDisplacementKg: number;
  /** Candidate builders (every nation except the ordering nation), ascending by nation id. */
  readonly builders: readonly ForeignBuilderCandidate[];
  /** The contract terms for the requested builder, or `null` when none was requested/known. */
  readonly contract: ForeignContractTermsPreview | null;
}

export type ForeignConstructionPreviewResult =
  | { readonly ok: true; readonly preview: ForeignConstructionPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

export interface ForeignConstructionPreviewOptions {
  /** The chosen builder; when present, the preview also derives the contract terms for it. */
  readonly builderNationId?: string;
  /** The player's requested delivery month; ignored unless a valid `YYYY-MM` at or after the last due month. */
  readonly plannedDeliveryMonth?: string;
}

/**
 * Resolve the foreign-order preview (SB3-R20/R23/R34) WITHOUT mutating the snapshot or reserving anything. It reuses
 * the exact derivation the order path uses (`resolveOrderTargets`, `builderDockRecord`,
 * `nationalConstructionCapacity`, `foreignBuilderCommittedMassKg`, `resolveForeignBuilderCapability`,
 * `deriveForeignContractTerms`), so the dialog and the command agree. A quantity outside `1..12` is refused with the
 * same `FOREIGN_CONSTRUCTION_QUANTITY_INVALID` code the command path uses. Pure and deterministic.
 */
export function previewForeignConstruction(
  snapshot: CampaignSnapshot,
  orderingNationId: string,
  designVersionId: string,
  quantity: number,
  content: ShipBuildingContent | undefined,
  month: string,
  options: ForeignConstructionPreviewOptions = {},
): ForeignConstructionPreviewResult {
  if (
    !Number.isInteger(quantity) ||
    quantity < CONSTRUCTION_BATCH_MIN_QUANTITY ||
    quantity > CONSTRUCTION_BATCH_MAX_QUANTITY
  )
    return {
      ok: false,
      reason: FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
      diagnostics: [
        `A foreign order is ${String(CONSTRUCTION_BATCH_MIN_QUANTITY)}..${String(CONSTRUCTION_BATCH_MAX_QUANTITY)} ships; got ${String(quantity)}.`,
      ],
    };
  const targets = resolveOrderTargets(snapshot, orderingNationId, designVersionId);
  if (!targets.ok) return { ok: false, reason: targets.reason, diagnostics: targets.diagnostics };
  const { design } = targets;
  const displacementKg = Number(design.normalizedDisplacementKg);
  // INC-16: `CompiledDesignVersion` carries no length/beam, so the dimension predicate is inert (mass only), matching
  // the order path.
  const demand: YardDemand = { lengthMm: 0, beamMm: 0, displacementKg, heaviestKg: 0 };

  const builders: ForeignBuilderCandidate[] = [];
  let selected: ForeignBuilderCandidate | null = null;
  for (const nation of snapshot["nations"].values()) {
    if (nation.id === orderingNationId) continue;
    const dock = builderDockRecord(snapshot, nation.id, content, month);
    const balance = content?.environmentFor(month, nation.id).constructionBalance;
    const capacity =
      dock !== null && balance !== undefined
        ? nationalConstructionCapacity(balance, dock.maximumNewConstructionMassKg ?? 0)
        : null;
    const reservedPerUnit =
      capacity !== null
        ? designNewConstructionReservedMassKg(design.hullType, displacementKg, capacity)
        : 0;
    const reservedMassKg = reservedPerUnit * quantity;
    const committed =
      capacity !== null ? foreignBuilderCommittedMassKg(snapshot, nation.id, capacity) : 0;
    const availableNewConstructionMassKg =
      capacity !== null ? Math.max(0, capacity.maxConcurrentMassKg - committed) : 0;
    const supply = resolveBuilderConstructionSupply(content, nation.id, month);
    const conditions = resolveForeignBuilderCapability(snapshot, content, {
      orderingNationId,
      builderNationId: nation.id,
      design,
      campaignMonth: month,
      constructionSupplyAvailable: supply.available,
      dock,
    });
    const capability = validateForeignBuilderCapability({
      demand,
      dock: dock ?? {},
      requiredTechnologySatisfied: conditions.requiredTechnologySatisfied,
      shipyardCapabilitySatisfied: conditions.shipyardCapabilitySatisfied,
      governmentPermissionSatisfied: conditions.governmentPermissionSatisfied,
      componentSourcingSatisfied: conditions.componentSourcingSatisfied,
      physicallyCapable: conditions.physicallyCapable,
      reservedMassKg,
      availableNewConstructionCapacityKg: availableNewConstructionMassKg,
    });
    // Parity with the order path (`placeForeignConstructionOrder`): a resolvable dock whose construction balance
    // cannot be resolved fails the CAPACITY predicate with `FOREIGN_BUILDER_CAPACITY_UNAVAILABLE`, never a silent 0 kg.
    const capacityUnavailable = dock !== null && capacity === null;
    const capabilitySatisfied = capability.satisfied && !capacityUnavailable;
    const dockCeilingKg = dock?.maximumNewConstructionMassKg ?? null;
    const rel = relationAndTension(snapshot, orderingNationId, nation.id);
    const capabilityReasons = capability.reasons.map((r) => `${r.field}: ${r.message}`);
    const candidate: ForeignBuilderCandidate = {
      nationId: nation.id,
      name: nation.name,
      tag: nation.tag,
      relation: rel.relation,
      tension: rel.tension,
      dockCeilingKg,
      reservedMassKg,
      availableNewConstructionMassKg,
      fitsDock: dockCeilingKg !== null && displacementKg <= dockCeilingKg,
      capabilitySatisfied,
      capabilityReasons: capacityUnavailable
        ? [
            "CAPACITY: The builder's construction balance could not be resolved.",
            ...capabilityReasons,
          ]
        : capabilityReasons,
      capabilityFailureCode: capacityUnavailable
        ? FOREIGN_BUILDER_CAPACITY_UNAVAILABLE
        : capability.satisfied
          ? null
          : capabilityFailureCode(capability),
      impoundmentRiskBp: rel.relation === "at_war" ? impoundmentProbabilityBp(rel.tension) : 0,
      // DESIGN-16 section 14: no treaty/contract-clause source exists yet (INC-10 deferral), so the shipped contract
      // always carries `NONE`; the preview reports the same, never a fabricated guarantee.
      deliveryGuarantee: false,
    };
    builders.push(candidate);
    if (options.builderNationId === nation.id) selected = candidate;
  }
  builders.sort((a, b) => (a.nationId < b.nationId ? -1 : a.nationId > b.nationId ? 1 : 0));

  const contract =
    selected === null ? null : contractPreview(design, selected, quantity, content, month, options);

  return {
    ok: true,
    preview: {
      designVersionId,
      quantity,
      designDisplacementKg: displacementKg,
      builders,
      contract,
    },
  };
}

/** The contract terms for a chosen builder, derived exactly as `applyOrderForeignConstruction` derives them. Pure. */
function contractPreview(
  design: ForeignContractTermsInput["design"],
  builder: ForeignBuilderCandidate,
  quantity: number,
  content: ShipBuildingContent | undefined,
  month: string,
  options: ForeignConstructionPreviewOptions,
): ForeignContractTermsPreview {
  const supply = resolveBuilderConstructionSupply(content, builder.nationId, month);
  const terms = deriveForeignContractTerms({
    design,
    quantity,
    builderNationId: builder.nationId,
    builderCostMultiplierBp: supply.costMultiplierBp,
    authorizationMonth: month,
    ...(options.plannedDeliveryMonth === undefined
      ? {}
      : { plannedDeliveryMonth: options.plannedDeliveryMonth }),
  });
  return {
    quantity: terms.quantity,
    totalWorkPerUnit: terms.totalWorkPerUnit,
    totalPriceUnits: terms.totalPriceUnits,
    paymentSchedule: terms.paymentSchedule,
    // The same single reservation entry `buildForeignConstructionContract` forms (DESIGN-16 section 13.3).
    capacityReservationSchedule: [
      {
        month: terms.authorizationMonth,
        reservedMassKg: builder.reservedMassKg,
        pool: FOREIGN_CONTRACT_POOL,
      },
    ],
    paymentGraceMonths: FOREIGN_PAYMENT_GRACE_MONTHS,
    plannedKeelMonth: terms.plannedKeelMonth,
    plannedDeliveryMonth: terms.plannedDeliveryMonth,
    reservedMassKg: builder.reservedMassKg,
    capabilitySatisfied: builder.capabilitySatisfied,
    capabilityReasons: builder.capabilityReasons,
    capabilityFailureCode: builder.capabilityFailureCode,
  };
}
