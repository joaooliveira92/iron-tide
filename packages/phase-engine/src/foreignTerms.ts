// packages/phase-engine/src/foreignTerms.ts
// INC-17: the engine-side, content-grounded derivation of a foreign construction contract's terms and the builder's
// capability predicates. The command/IPC boundary trusts the renderer only for the player's choices (design, builder,
// quantity, optional delivery month); everything the manual leaves undefined here — the price, the instalment schedule,
// the capability booleans — is derived from authoritative content (`@bluewave/ship-design` naval profiles, the compiled
// design's projected cost, the ordering↔builder relation). Pure, integer-only, no wall clock, no randomness.
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

/** The identity of the shipped instalment policy the derived schedule follows (six equal monthly instalments). */
export const FOREIGN_INSTALMENT_POLICY_ID = "foreign_instalment_policy_v1" as const;

/** The number of equal monthly instalments in the shipped policy. */
export const FOREIGN_INSTALMENT_COUNT = 6 as const;

/** The stable reason the engine refuses a foreign order whose quantity is outside `1..12`. */
export const FOREIGN_CONSTRUCTION_QUANTITY_INVALID =
  "FOREIGN_CONSTRUCTION_QUANTITY_INVALID" as const;

/**
 * The stable reason the engine refuses a foreign order whose body still carries renderer-supplied `terms`/`capability`.
 * The contract is derived server-side; a fabricated one is never accepted.
 */
export const FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED = "FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED" as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A `YYYY-MM` month advanced by `delta` calendar months, integer-only. */
function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const next = advanceMonth(year, m, delta);
  return monthId(next.year, next.month);
}

/**
 * Split a non-negative integer total into `count` non-negative integer parts that sum EXACTLY to the total, spreading
 * the remainder one unit at a time over the earliest parts (largest-remainder / Hamilton apportionment). Integer-only.
 */
function splitLargestRemainder(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export interface ForeignContractTermsInput {
  readonly design: CompiledDesignVersion;
  /** The builder's resolved `resolveNationalConstruction` cost modifier; `10_000` when no profile resolves. */
  readonly builderCostMultiplierBp?: number;
  readonly quantity: number;
  readonly builderNationId: string;
  readonly authorizationMonth: string;
  /** The player's requested delivery month; ignored unless a valid `YYYY-MM` at or after the last due month. */
  readonly plannedDeliveryMonth?: string;
}

/**
 * Derive the complete contract terms for a foreign order from authoritative content. `totalWorkPerUnit` is the projected
 * order cost under the BUILDER's resolved national construction multiplier (the builder builds the hull), and `totalPriceUnits`
 * is the order's whole price — `totalWorkPerUnit × quantity`, so payment, capacity reservation and project work all agree.
 * The schedule is `FOREIGN_INSTALMENT_COUNT` equal monthly instalments starting at the authorization month, split so
 * amounts sum exactly to `totalPriceUnits` and work shares sum exactly to `10_000`. Pure and deterministic.
 */
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
    amountUnits,
    workShareBp: shares[i]!,
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

/** The builder's resolved construction supply at a month. */
export interface BuilderConstructionSupply {
  /** False when no profile resolves or the builder cannot obtain its main armament or armour plate (fail closed). */
  readonly available: boolean;
  /** The builder's resolved `resolveNationalConstruction` cost modifier; `10_000` when no usable supply resolves. */
  readonly costMultiplierBp: number;
}

/**
 * Resolve the BUILDER's construction supply for a foreign order (the price multiplier and whether supply is obtainable).
 * `resolveNationalConstruction` throws when the builder cannot obtain its armament or armour plate under the current
 * access policy; the order path must fail closed with a capability refusal, never abort the month, so the throw is caught
 * here and reported as `available: false`. Pure; integer-only.
 */
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
  /** True when the builder can obtain its main armament and armour plate (from `resolveBuilderConstructionSupply`). */
  readonly constructionSupplyAvailable: boolean;
  /** The builder's resolved dock, materialised or profile-derived; `null` when neither exists (DOCK fails closed). */
  readonly dock: Partial<DockRecord> | null;
}

/** The ordering↔builder diplomatic relation and tension, matching `nationA`/`nationB` in either order. */
export interface DiplomaticRelationAndTension {
  /** `null` when no relation is recorded. */
  readonly relation: DiplomaticRelation["relation"] | null;
  readonly tension: number;
}

/**
 * The ordering↔builder diplomatic relation and tension, or `{ relation: null, tension: 0 }` when none is recorded. The
 * one shared reader for the preview, the capability resolver and the monthly step, so they can never disagree. Pure.
 */
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

/**
 * Resolve the builder's capability predicates (DESIGN-16 section 13.2) from authoritative content and the current
 * snapshot, fail-closed: a builder with no dock, no naval profile or no construction environment cannot satisfy the
 * shipyard/technology/component predicates. Government permission and physical capability hold unless the ordering and
 * builder nations are `at_war` (occupation is not modelled — a recorded deferral carried by INC-10's war-effects owner).
 * Pure.
 */
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
