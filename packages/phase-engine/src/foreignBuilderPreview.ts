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

export interface ForeignCapacityReservationPreview {
  readonly month: string;
  readonly reservedMassKg: number;
  readonly pool: string;
}

export interface ForeignBuilderCandidate {
  readonly nationId: string;
  readonly name: string;
  readonly tag: string;
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement" | null;
  readonly tension: number;
  readonly dockCeilingKg: number | null;
  readonly reservedMassKg: number;
  readonly availableNewConstructionMassKg: number;
  readonly fitsDock: boolean;
  readonly capabilitySatisfied: boolean;
  readonly capabilityReasons: readonly string[];
  readonly capabilityFailureCode: string | null;
  readonly impoundmentRiskBp: number;
  readonly deliveryGuarantee: boolean;
}

export interface ForeignContractTermsPreview {
  readonly quantity: number;
  readonly totalWorkPerUnit: number;
  readonly totalPriceUnits: number;
  readonly paymentSchedule: readonly ForeignContractPaymentInstallment[];
  readonly capacityReservationSchedule: readonly ForeignCapacityReservationPreview[];
  readonly paymentGraceMonths: number;
  readonly plannedKeelMonth: string;
  readonly plannedDeliveryMonth: string;
  readonly reservedMassKg: number;
  readonly capabilitySatisfied: boolean;
  readonly capabilityReasons: readonly string[];
  readonly capabilityFailureCode: string | null;
}

export interface ForeignConstructionPreview {
  readonly designVersionId: string;
  readonly quantity: number;
  readonly designDisplacementKg: number;
  readonly builders: readonly ForeignBuilderCandidate[];
  readonly contract: ForeignContractTermsPreview | null;
}

export type ForeignConstructionPreviewResult =
  | { readonly ok: true; readonly preview: ForeignConstructionPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

export interface ForeignConstructionPreviewOptions {
  readonly builderNationId?: string;
  readonly plannedDeliveryMonth?: string;
}

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
