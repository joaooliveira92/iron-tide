// packages/ship-design/src/constructionCapacity.ts
// DESIGN-16 sections 7-9 (spec SB3-R18/R19): the national concurrency cap and the AMC/small-corvette construction
// capacity exemption. The cap is a *displacement reservation layered on top of* the work-micro-unit pools: it governs
// how much tonnage may be under construction at once, never how fast work is applied. The two are deliberately kept
// separate (DESIGN-16 section 7 vs section 10; ADR-0067 section 6). Pure and platform-independent.
import { HULL_TYPE_FOR_SHIP_TYPE } from "./shipTypes.js";
import { toSafe } from "./units.js";

/** DESIGN-16 section 7.1: the four shipyard construction-capacity pools. */
export const CONSTRUCTION_CAPACITY_POOLS = [
  "NEW_CONSTRUCTION",
  "REPAIR",
  "REFIT_REBUILD",
  "INFRASTRUCTURE",
] as const;
export type ConstructionCapacityPool = (typeof CONSTRUCTION_CAPACITY_POOLS)[number];

/** DESIGN-16 section 17: reservations are ordered by pool priority before any identifier. Lower value allocates first. */
export const CAPACITY_POOL_PRIORITY: Readonly<Record<ConstructionCapacityPool, number>> = {
  NEW_CONSTRUCTION: 0,
  REPAIR: 1,
  REFIT_REBUILD: 2,
  INFRASTRUCTURE: 3,
};

/**
 * DESIGN-13 section 32 stably names the order-time capacity refusal `INSUFFICIENT_PROJECT_CAPACITY`; DESIGN-16 section
 * 18's `SHIPYARD_CAPACITY_EXCEEDED` is scoped to exceeding a pool's *monthly work* rate (section 7.3). The national
 * concurrency cap is a project-authorization reservation, so this module uses the project-capacity code.
 */
export const INSUFFICIENT_PROJECT_CAPACITY = "INSUFFICIENT_PROJECT_CAPACITY" as const;

/** The project kinds campaign state stores; mirrored here so ship-design keeps no campaign dependency. */
export type CapacityProjectKind = "NEW_CONSTRUCTION" | "REBUILD" | "INFRASTRUCTURE";

/**
 * DESIGN-16 section 8: the shipped project-to-pool mapping. Surface and submarine new construction both book to
 * `NEW_CONSTRUCTION` (a submarine MUST NOT get a hidden or zero-cost pool); a rebuild books to `REFIT_REBUILD`, so it
 * is outside the new-construction concurrency cap entirely. Repair and infrastructure projects are not modelled here.
 */
export function constructionPoolForProjectKind(
  kind: CapacityProjectKind,
): ConstructionCapacityPool {
  if (kind === "REBUILD") return "REFIT_REBUILD";
  if (kind === "INFRASTRUCTURE") return "INFRASTRUCTURE";
  return "NEW_CONSTRUCTION";
}

/**
 * DESIGN-16 section 7 (SB3-R18): the total displacement that may be under construction in the `NEW_CONSTRUCTION` pool at
 * once, `floor(dockMaxMassKg * multipleBp / 10_000)`. Integer-only with a BigInt intermediate, so it is exact and
 * deterministic. Zero when the dock size or multiple is missing or invalid (fail closed, never a silent fallback).
 */
export function maxConcurrentConstructionMassKg(dockMaxMassKg: number, multipleBp: number): number {
  if (!Number.isSafeInteger(dockMaxMassKg) || dockMaxMassKg <= 0) return 0;
  if (!Number.isSafeInteger(multipleBp) || multipleBp <= 0) return 0;
  return toSafe(
    "maxConcurrentConstructionMassKg",
    (BigInt(dockMaxMassKg) * BigInt(multipleBp)) / 10_000n,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// ConstructionCapacityExemptionDefinition (DESIGN-16 section 9)
// ---------------------------------------------------------------------------------------------------------------

/** The canonical ship types an exemption may name (the keys of the engine hull-type map). */
export type ExemptibleShipType = keyof typeof HULL_TYPE_FOR_SHIP_TYPE;

export const CAPACITY_EXEMPTION_STACKING_RULES = ["MAX_EXEMPTION", "SUM_EXEMPTION"] as const;
export type CapacityExemptionStackingRule = (typeof CAPACITY_EXEMPTION_STACKING_RULES)[number];

/**
 * DESIGN-16 section 9: everything a future ruleset MUST declare to exempt a ship type from normal construction
 * capacity. The exemption is backed by a named external capacity source; it never creates capacity from nothing.
 */
export interface ConstructionCapacityExemptionDefinition {
  readonly definitionId: string;
  /** The canonical ship type the exemption covers (DESIGN-16 section 9 "eligible ship type"). */
  readonly eligibleShipType: ExemptibleShipType;
  /** Stable id of the eligibility predicate the definition uses. */
  readonly eligibilityPredicateId: string;
  /** Largest displacement that qualifies; a larger hull of the type is not exempt. */
  readonly maximumQualifyingDisplacementKg: number;
  /** Exempt share of the project's capacity use, basis points within `0..10_000`. */
  readonly exemptCapacityBp: number;
  /** Ceiling on the mass the external source may carry per month (the exemption's declared physical bound). */
  readonly monthlyAggregateExemptionCapKg: number;
  /** The declared external capacity source that backs the exempt share. */
  readonly externalCapacitySourceId: string;
  /** How two applicable exemptions combine; `MAX_EXEMPTION` takes the larger exempt share. */
  readonly stackingRule: CapacityExemptionStackingRule;
  readonly version: number;
}

/** The ship a predicate judges: its engine hull type and compiled displacement. */
export interface CapacityExemptionShip {
  readonly hullType: string;
  readonly displacementKg: number;
}

/** Stable id of the shipped type-and-displacement eligibility predicate. */
export const SHIPPED_CAPACITY_EXEMPTION_PREDICATE_ID = "ship_type_and_max_displacement_v1";

/**
 * DESIGN-16 section 9 eligibility: the ship is of the exempt type and no larger than the qualifying displacement. The
 * shipped predicate never reads ship name, class description or a UI category, exactly as the contract requires.
 */
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

/**
 * DESIGN-16 section 9: `normalPoolConsumption = ceiling(appliedWork * (10_000 - exemptCapacityBp) / 10_000)`. Ceiling
 * division with a BigInt intermediate; never negative. Missing or out-of-range exemption data means exactly zero
 * exempt basis points, because the shipped value is explicit.
 */
export function normalPoolConsumption(appliedWork: number, exemptCapacityBp: number): number {
  const work = Number.isSafeInteger(appliedWork) && appliedWork > 0 ? appliedWork : 0;
  const bp = Number.isFinite(exemptCapacityBp)
    ? Math.min(10_000, Math.max(0, Math.floor(exemptCapacityBp)))
    : 0;
  // ceil(work * (10_000 - bp) / 10_000) = floor((work * (10_000 - bp) + 9_999) / 10_000)
  return toSafe("normalPoolConsumption", (BigInt(work) * BigInt(10_000 - bp) + 9_999n) / 10_000n);
}

/** DESIGN-16 section 9: `externalPoolConsumption = appliedWork - normalPoolConsumption`. */
export function externalPoolConsumption(appliedWork: number, exemptCapacityBp: number): number {
  const work = Number.isSafeInteger(appliedWork) && appliedWork > 0 ? appliedWork : 0;
  return work - normalPoolConsumption(work, exemptCapacityBp);
}

/** The effective exempt share when several definitions match: their stacking rule applied in declaration order. */
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

/**
 * The displacement a ship reserves against the `NEW_CONSTRUCTION` concurrency cap: its non-exempt share, from the
 * DESIGN-16 section 9 split. A fully exempt ship reserves zero; an ordinary ship reserves its whole displacement.
 */
export function reservedNewConstructionMassKg(
  ship: CapacityExemptionShip,
  definitions: readonly ConstructionCapacityExemptionDefinition[],
): number {
  return normalPoolConsumption(ship.displacementKg, effectiveExemptCapacityBp(definitions, ship));
}

// ---------------------------------------------------------------------------------------------------------------
// Shipped exemption definitions (built from versioned balance constants)
// ---------------------------------------------------------------------------------------------------------------

export const AMC_CAPACITY_EXEMPTION_DEFINITION_ID = "amc_new_construction_capacity_exemption_v1";
export const SMALL_CORVETTE_CAPACITY_EXEMPTION_DEFINITION_ID =
  "small_corvette_new_construction_capacity_exemption_v1";
export const AMC_EXTERNAL_CAPACITY_SOURCE_ID = "merchant_shipyards";
export const SMALL_CORVETTE_EXTERNAL_CAPACITY_SOURCE_ID = "civilian_shipyards";

/** The versioned balance constants the shipped exemption definitions are built from. */
export interface ConstructionCapacityBalance {
  /** The manual's "multiple of dock size" for the concurrency cap, basis points of dock mass (10_000 = 1x). */
  readonly shipyardCapacityMultipleBp: number;
  /** AMC/small-corvette exempt share, basis points within `0..10_000`. */
  readonly amcCapacityExemptionBp: number;
  /** Displacement at or below which a corvette (KE) is a "small corvette". */
  readonly smallCorvetteMaxDisplacementKg: number;
}

/**
 * The shipped `ConstructionCapacityExemptionDefinition`s for a nation, from its versioned balance and dock size: an AMC
 * exemption and a small-corvette (KE) exemption, each backed by its own declared external capacity source. The
 * monthly aggregate exemption cap is the nation's own concurrency cap, so the external source can never manufacture
 * more capacity than the nation physically has.
 */
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
      // An AMC is bounded only by the dock itself (section 4.2); the exemption adds no tighter displacement bound.
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

// ---------------------------------------------------------------------------------------------------------------
// Deterministic reservation ordering (DESIGN-16 section 17)
// ---------------------------------------------------------------------------------------------------------------

export interface CapacityReservation {
  readonly pool: ConstructionCapacityPool;
  readonly projectId: string;
  readonly massKg: number;
}

/** Order reservations by pool priority, then ascending project identifier. Database order can never change a result. */
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

/**
 * Allocate a pool's mass capacity to reservations in canonical order (DESIGN-16 section 17). A reservation that would
 * take the running total above the cap is rejected; later smaller reservations may still fit. Pure and deterministic.
 */
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
