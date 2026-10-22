import { bp, money } from "@bluewave/contracts";
import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  DiplomaticRelation,
} from "@bluewave/campaign";
import { advanceMonth, monthId } from "@bluewave/campaign";
import { projectedConstructionOrderCosts } from "@bluewave/campaign-engine";
import {
  resolveNationalConstruction,
  shipTypeForHullType,
  type DockRecord,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import type {
  ForeignBuilderCapabilityConditions,
  ForeignContractTerms,
} from "./foreignConstruction.js";

export const FOREIGN_INSTALMENT_POLICY_ID = "foreign_instalment_policy_v1" as const;

export const FOREIGN_INSTALMENT_COUNT = 6 as const;

export const FOREIGN_CONSTRUCTION_QUANTITY_INVALID =
  "FOREIGN_CONSTRUCTION_QUANTITY_INVALID" as const;

export const FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED = "FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED" as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const next = advanceMonth(year, m, delta);
  return monthId(next.year, next.month);
}

function splitLargestRemainder(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export interface ForeignContractTermsInput {
  readonly design: CompiledDesignVersion;
  readonly builderCostMultiplierBp?: number;
  readonly quantity: number;
  readonly builderNationId: string;
  readonly authorizationMonth: string;
  readonly plannedDeliveryMonth?: string;
}

export function deriveForeignContractTerms(input: ForeignContractTermsInput): ForeignContractTerms {
  const projected = projectedConstructionOrderCosts(
    input.design,
    input.builderCostMultiplierBp ?? 10_000,
  );
  const totalWorkPerUnit = projected.projectedCost;
  const totalPriceUnits = totalWorkPerUnit * input.quantity;
  const amounts = splitLargestRemainder(totalPriceUnits, FOREIGN_INSTALMENT_COUNT);
  const shares = splitLargestRemainder(10_000, FOREIGN_INSTALMENT_COUNT);
  const paymentSchedule = amounts.map((amountUnits, i) => ({
    dueMonth: addMonths(input.authorizationMonth, i),
    amountUnits: money(amountUnits),
    workShareBp: bp(shares[i]!),
  }));
  const lastDueMonth = addMonths(input.authorizationMonth, FOREIGN_INSTALMENT_COUNT - 1);
  const requested = input.plannedDeliveryMonth;
  const plannedDeliveryMonth =
    requested !== undefined && MONTH_RE.test(requested) && requested >= lastDueMonth
      ? requested
      : lastDueMonth;
  return {
    builderShipyardId: `yard:${input.builderNationId}`,
    quantity: input.quantity,
    totalWorkPerUnit,
    totalPriceUnits,
    paymentSchedule,
    authorizationMonth: input.authorizationMonth,
    plannedKeelMonth: input.authorizationMonth,
    plannedDeliveryMonth,
  };
}

export interface BuilderConstructionSupply {
  readonly available: boolean;
  readonly costMultiplierBp: number;
}

export function resolveBuilderConstructionSupply(
  content: ShipBuildingContent | undefined,
  builderNationId: string,
  campaignMonth: string,
): BuilderConstructionSupply {
  const profile = content?.navalProfileFor(builderNationId, campaignMonth) ?? null;
  if (profile === null) return { available: false, costMultiplierBp: 10_000 };
  try {
    const multiplier = resolveNationalConstruction(profile, campaignMonth).costMultiplierBp;
    return { available: true, costMultiplierBp: multiplier };
  } catch {
    return { available: false, costMultiplierBp: 10_000 };
  }
}

export interface ForeignBuilderCapabilityResolutionInput {
  readonly orderingNationId: string;
  readonly builderNationId: string;
  readonly design: CompiledDesignVersion;
  readonly campaignMonth: string;
  readonly constructionSupplyAvailable: boolean;
  readonly dock: Partial<DockRecord> | null;
}

export interface DiplomaticRelationAndTension {
  readonly relation: DiplomaticRelation["relation"] | null;
  readonly tension: number;
}

export function relationAndTension(
  snapshot: CampaignSnapshot,
  a: string,
  b: string,
): DiplomaticRelationAndTension {
  const rel = snapshot["politics"].relations.find(
    (r) => (r["nationA"] === a && r["nationB"] === b) || (r["nationA"] === b && r["nationB"] === a),
  );
  return rel === undefined
    ? { relation: null, tension: 0 }
    : { relation: rel["relation"], tension: rel["tension"] };
}

export function resolveForeignBuilderCapability(
  snapshot: CampaignSnapshot,
  content: ShipBuildingContent | undefined,
  input: ForeignBuilderCapabilityResolutionInput,
): ForeignBuilderCapabilityConditions {
  const profile = content?.navalProfileFor(input.builderNationId, input.campaignMonth) ?? null;
  const atWar =
    relationAndTension(snapshot, input.orderingNationId, input.builderNationId).relation ===
    "at_war";
  const shipType = shipTypeForHullType(input.design.hullType);
  return {
    shipyardCapabilitySatisfied: input.dock !== null,
    requiredTechnologySatisfied:
      profile !== null &&
      (shipType === null || !profile.hardCapabilities.restrictedShipTypes.includes(shipType)),
    componentSourcingSatisfied: profile !== null && input.constructionSupplyAvailable,
    governmentPermissionSatisfied: !atWar,
    physicallyCapable: !atWar,
  };
}
