import { HULL_TYPE_FOR_SHIP_TYPE } from "./shipTypes.js";
import { toSafe } from "./units.js";

export const CONSTRUCTION_CAPACITY_POOLS = [
  "NEW_CONSTRUCTION",
  "REPAIR",
  "REFIT_REBUILD",
  "INFRASTRUCTURE",
] as const;
export type ConstructionCapacityPool = (typeof CONSTRUCTION_CAPACITY_POOLS)[number];

export const CAPACITY_POOL_PRIORITY: Readonly<Record<ConstructionCapacityPool, number>> = {
  NEW_CONSTRUCTION: 0,
  REPAIR: 1,
  REFIT_REBUILD: 2,
  INFRASTRUCTURE: 3,
};

export const INSUFFICIENT_PROJECT_CAPACITY = "INSUFFICIENT_PROJECT_CAPACITY" as const;

export type CapacityProjectKind = "NEW_CONSTRUCTION" | "REBUILD" | "INFRASTRUCTURE";

export function constructionPoolForProjectKind(
  kind: CapacityProjectKind,
): ConstructionCapacityPool {
  if (kind === "REBUILD") return "REFIT_REBUILD";
  if (kind === "INFRASTRUCTURE") return "INFRASTRUCTURE";
  return "NEW_CONSTRUCTION";
}

export function maxConcurrentConstructionMassKg(dockMaxMassKg: number, multipleBp: number): number {
  if (!Number.isSafeInteger(dockMaxMassKg) || dockMaxMassKg <= 0) return 0;
  if (!Number.isSafeInteger(multipleBp) || multipleBp <= 0) return 0;
  return toSafe(
    "maxConcurrentConstructionMassKg",
    (BigInt(dockMaxMassKg) * BigInt(multipleBp)) / 10_000n,
  );
}

export type ExemptibleShipType = keyof typeof HULL_TYPE_FOR_SHIP_TYPE;

export const CAPACITY_EXEMPTION_STACKING_RULES = ["MAX_EXEMPTION", "SUM_EXEMPTION"] as const;
export type CapacityExemptionStackingRule = (typeof CAPACITY_EXEMPTION_STACKING_RULES)[number];

export interface ConstructionCapacityExemptionDefinition {
  readonly definitionId: string;
  readonly eligibleShipType: ExemptibleShipType;
  readonly eligibilityPredicateId: string;
  readonly maximumQualifyingDisplacementKg: number;
  readonly exemptCapacityBp: number;
  readonly monthlyAggregateExemptionCapKg: number;
  readonly externalCapacitySourceId: string;
  readonly stackingRule: CapacityExemptionStackingRule;
  readonly version: number;
}

export interface CapacityExemptionShip {
  readonly hullType: string;
  readonly displacementKg: number;
}

export const SHIPPED_CAPACITY_EXEMPTION_PREDICATE_ID = "ship_type_and_max_displacement_v1";

export function capacityExemptionApplies(
  def: ConstructionCapacityExemptionDefinition,
  ship: CapacityExemptionShip,
): boolean {
  return (
    ship.hullType === HULL_TYPE_FOR_SHIP_TYPE[def.eligibleShipType] &&
    Number.isSafeInteger(ship.displacementKg) &&
    ship.displacementKg > 0 &&
    ship.displacementKg <= def.maximumQualifyingDisplacementKg
  );
}

export function normalPoolConsumption(appliedWork: number, exemptCapacityBp: number): number {
  const work = Number.isSafeInteger(appliedWork) && appliedWork > 0 ? appliedWork : 0;
  const bp = Number.isFinite(exemptCapacityBp)
    ? Math.min(10_000, Math.max(0, Math.floor(exemptCapacityBp)))
    : 0;
  return toSafe("normalPoolConsumption", (BigInt(work) * BigInt(10_000 - bp) + 9_999n) / 10_000n);
}

export function externalPoolConsumption(appliedWork: number, exemptCapacityBp: number): number {
  const work = Number.isSafeInteger(appliedWork) && appliedWork > 0 ? appliedWork : 0;
  return work - normalPoolConsumption(work, exemptCapacityBp);
}

export function effectiveExemptCapacityBp(
  definitions: readonly ConstructionCapacityExemptionDefinition[],
  ship: CapacityExemptionShip,
): number {
  let exemptBp = 0;
  for (const def of definitions) {
    if (!capacityExemptionApplies(def, ship)) continue;
    const bp = Math.min(10_000, Math.max(0, Math.floor(def.exemptCapacityBp)));
    exemptBp =
      def.stackingRule === "SUM_EXEMPTION"
        ? Math.min(10_000, exemptBp + bp)
        : Math.max(exemptBp, bp);
  }
  return exemptBp;
}

export function reservedNewConstructionMassKg(
  ship: CapacityExemptionShip,
  definitions: readonly ConstructionCapacityExemptionDefinition[],
): number {
  return normalPoolConsumption(ship.displacementKg, effectiveExemptCapacityBp(definitions, ship));
}

export const AMC_CAPACITY_EXEMPTION_DEFINITION_ID = "amc_new_construction_capacity_exemption_v1";
export const SMALL_CORVETTE_CAPACITY_EXEMPTION_DEFINITION_ID =
  "small_corvette_new_construction_capacity_exemption_v1";
export const AMC_EXTERNAL_CAPACITY_SOURCE_ID = "merchant_shipyards";
export const SMALL_CORVETTE_EXTERNAL_CAPACITY_SOURCE_ID = "civilian_shipyards";

export interface ConstructionCapacityBalance {
  readonly shipyardCapacityMultipleBp: number;
  readonly amcCapacityExemptionBp: number;
  readonly smallCorvetteMaxDisplacementKg: number;
}

export function shippedConstructionCapacityExemptions(
  balance: ConstructionCapacityBalance,
  dockMaxMassKg: number,
): readonly ConstructionCapacityExemptionDefinition[] {
  const monthlyCap = maxConcurrentConstructionMassKg(
    dockMaxMassKg,
    balance.shipyardCapacityMultipleBp,
  );
  return [
    {
      definitionId: AMC_CAPACITY_EXEMPTION_DEFINITION_ID,
      eligibleShipType: "AMC",
      eligibilityPredicateId: SHIPPED_CAPACITY_EXEMPTION_PREDICATE_ID,
      maximumQualifyingDisplacementKg: dockMaxMassKg,
      exemptCapacityBp: balance.amcCapacityExemptionBp,
      monthlyAggregateExemptionCapKg: monthlyCap,
      externalCapacitySourceId: AMC_EXTERNAL_CAPACITY_SOURCE_ID,
      stackingRule: "MAX_EXEMPTION",
      version: 1,
    },
    {
      definitionId: SMALL_CORVETTE_CAPACITY_EXEMPTION_DEFINITION_ID,
      eligibleShipType: "KE",
      eligibilityPredicateId: SHIPPED_CAPACITY_EXEMPTION_PREDICATE_ID,
      maximumQualifyingDisplacementKg: Math.min(
        balance.smallCorvetteMaxDisplacementKg,
        dockMaxMassKg,
      ),
      exemptCapacityBp: balance.amcCapacityExemptionBp,
      monthlyAggregateExemptionCapKg: monthlyCap,
      externalCapacitySourceId: SMALL_CORVETTE_EXTERNAL_CAPACITY_SOURCE_ID,
      stackingRule: "MAX_EXEMPTION",
      version: 1,
    },
  ];
}

export interface CapacityReservation {
  readonly pool: ConstructionCapacityPool;
  readonly projectId: string;
  readonly massKg: number;
}

export function compareCapacityReservations(
  a: CapacityReservation,
  b: CapacityReservation,
): number {
  return (
    CAPACITY_POOL_PRIORITY[a.pool] - CAPACITY_POOL_PRIORITY[b.pool] ||
    (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0)
  );
}

export interface CapacityAllocation {
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
  readonly allocatedMassKg: number;
}

export function allocateConstructionReservations(
  reservations: readonly CapacityReservation[],
  capMassKg: number,
): CapacityAllocation {
  const accepted: string[] = [];
  const rejected: string[] = [];
  let allocated = 0;
  for (const r of [...reservations].sort(compareCapacityReservations)) {
    if (Number.isSafeInteger(r.massKg) && r.massKg >= 0 && allocated + r.massKg <= capMassKg) {
      allocated += r.massKg;
      accepted.push(r.projectId);
    } else {
      rejected.push(r.projectId);
    }
  }
  return { accepted, rejected, allocatedMassKg: allocated };
}
