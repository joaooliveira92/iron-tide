// DESIGN-41 §4 — Stage 1: Hit location resolution.
// A pure function that maps impact parameters (coordinates + trajectory) to
// the primary compartment and armor zone struck. All arithmetic is integer
// mm (DESIGN-07). No convenience relocation (AC-4, DESIGN-41 §4).
// Pure/deterministic: no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import { type ArmorZoneType } from "./armorModel.js";
import { DAMAGE_HIT_LOCATION_INVALID } from "./reasonCodes.js";
import { type ArmorZoneDef, type CompartmentDef } from "./shipLayout.js";

// HitInput — all parameters needed to resolve the hit location.
export interface HitInput {
  /** Vertical coordinate along ship height (mm). */
  impactVerticalMm: number;
  /** Longitudinal coordinate along ship length (mm). */
  impactLongitudinalMm: number;
  /** Height above keel (mm). */
  impactAltitudeMm: number;
  /** Projectile trajectory angle relative to horizontal (degrees). */
  projectileTrajectoryDeg: number;
  /** Ordered list of compartment definitions (spatial layout). */
  compartments: readonly CompartmentDef[];
  /** Ordered list of armor zone definitions. */
  zones: readonly ArmorZoneDef[];
}

// HitResult — resolved hit location.
export interface HitResult {
  /** The compartment that contains the impact point. */
  primaryCompartmentId: string;
  /** The type of armor zone struck. */
  hitZoneType: ArmorZoneType;
  /** The stable id of the armor zone struck. */
  hitZoneId: string;
  /** Ids of compartments adjacent to the primary compartment. */
  adjacentCompartmentIds: readonly string[];
}

// Internal helpers

/**
 * Check whether a value falls within an inclusive interval [min, max].
 */
function withinInclusive(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

/**
 * Check whether two intervals [aMin, aMax] and [bMin, bMax] overlap
 * (including touching boundaries).
 */
function intervalsOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

/**
 * Determine whether two compartments are adjacent (share a face).
 * Two compartments are adjacent when their bounding boxes touch in
 * at least one dimension (one's max equals the other's min) and overlap
 * in the other two dimensions.
 */
function compartmentsAreAdjacent(a: CompartmentDef, b: CompartmentDef): boolean {
  // Which dimensions touch?
  const zTouch = a.zMaxMm === b.zMinMm || a.zMinMm === b.zMaxMm;
  const xTouch = a.xMaxMm === b.xMinMm || a.xMinMm === b.xMaxMm;
  const altTouch = a.altitudeMaxMm === b.altitudeMinMm || a.altitudeMinMm === b.altitudeMaxMm;

  const touchCount = (zTouch ? 1 : 0) + (xTouch ? 1 : 0) + (altTouch ? 1 : 0);
  if (touchCount === 0) return false;

  // Non-touching dimensions must overlap (including at boundaries)
  if (!zTouch && !intervalsOverlap(a.zMinMm, a.zMaxMm, b.zMinMm, b.zMaxMm)) return false;
  if (!xTouch && !intervalsOverlap(a.xMinMm, a.xMaxMm, b.xMinMm, b.xMaxMm)) return false;
  if (
    !altTouch &&
    !intervalsOverlap(a.altitudeMinMm, a.altitudeMaxMm, b.altitudeMinMm, b.altitudeMaxMm)
  )
    return false;

  return true;
}

// Public API

/**
 * Resolve the hit location: determine which compartment and armor zone the
 * impact point falls into. Pure function, deterministic.
 *
 * @param input - The impact parameters and ship layout.
 * @returns The resolved hit result.
 * @throws BluewaveError(DAMAGE_HIT_LOCATION_INVALID) if the hit misses all compartments.
 *
 * Per DESIGN-41 §4 / AC-4: no convenience relocation — if the hit point
 * falls outside every compartment, the function raises an error rather than
 * relocating to the nearest compartment.
 */
export function resolveHitLocation(input: HitInput): HitResult {
  // Step 1: Find the compartment that contains the impact point (3D AABB check).
  const hitCompartment = input.compartments.find(
    (c) =>
      withinInclusive(input.impactVerticalMm, c.zMinMm, c.zMaxMm) &&
      withinInclusive(input.impactLongitudinalMm, c.xMinMm, c.xMaxMm) &&
      withinInclusive(input.impactAltitudeMm, c.altitudeMinMm, c.altitudeMaxMm),
  );

  if (!hitCompartment) {
    throw new BluewaveError(DAMAGE_HIT_LOCATION_INVALID, {
      code: DAMAGE_HIT_LOCATION_INVALID,
      verticalMm: input.impactVerticalMm,
      longitudinalMm: input.impactLongitudinalMm,
      altitudeMm: input.impactAltitudeMm,
      reason: `hit at vertical=${input.impactVerticalMm}, longitudinal=${input.impactLongitudinalMm}, altitude=${input.impactAltitudeMm} does not intersect any compartment`,
    });
  }

  // Step 2: Determine the armor zone for this compartment.
  // Convention: the caller sets zone.id to match the compartment's id, or the
  // first matching zone by id. If no zone matches, fall back to the first zone.
  const hitZone = input.zones.find((z) => z.id === hitCompartment.id) ?? input.zones[0] ?? null;

  if (!hitZone) {
    throw new BluewaveError(DAMAGE_HIT_LOCATION_INVALID, {
      code: DAMAGE_HIT_LOCATION_INVALID,
      verticalMm: input.impactVerticalMm,
      longitudinalMm: input.impactLongitudinalMm,
      altitudeMm: input.impactAltitudeMm,
      reason: `hit at vertical=${input.impactVerticalMm}, longitudinal=${input.impactLongitudinalMm}, altitude=${input.impactAltitudeMm} lands in compartment ${hitCompartment.id} but no armor zone definition found`,
    });
  }

  // Step 3: Find adjacent compartments (those sharing a face with the hit compartment).
  const adjacentCompartmentIds = input.compartments
    .filter((c) => c.id !== hitCompartment.id && compartmentsAreAdjacent(hitCompartment, c))
    .map((c) => c.id);

  return {
    primaryCompartmentId: hitCompartment.id,
    hitZoneType: hitZone.zoneType,
    hitZoneId: hitZone.id,
    adjacentCompartmentIds,
  };
}
