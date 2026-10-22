import { BluewaveError } from "@bluewave/contracts";
import { type ArmorZoneType } from "./armorModel.js";
import { DAMAGE_HIT_LOCATION_INVALID } from "./reasonCodes.js";
import { type ArmorZoneDef, type CompartmentDef } from "./shipLayout.js";

export interface HitInput {
  impactVerticalMm: number;
  impactLongitudinalMm: number;
  impactAltitudeMm: number;
  projectileTrajectoryDeg: number;
  compartments: readonly CompartmentDef[];
  zones: readonly ArmorZoneDef[];
}

export interface HitResult {
  primaryCompartmentId: string;
  hitZoneType: ArmorZoneType;
  hitZoneId: string;
  adjacentCompartmentIds: readonly string[];
}

function withinInclusive(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

function intervalsOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

function compartmentsAreAdjacent(a: CompartmentDef, b: CompartmentDef): boolean {
  const zTouch = a.zMaxMm === b.zMinMm || a.zMinMm === b.zMaxMm;
  const xTouch = a.xMaxMm === b.xMinMm || a.xMinMm === b.xMaxMm;
  const altTouch = a.altitudeMaxMm === b.altitudeMinMm || a.altitudeMinMm === b.altitudeMaxMm;

  const touchCount = (zTouch ? 1 : 0) + (xTouch ? 1 : 0) + (altTouch ? 1 : 0);
  if (touchCount === 0) return false;

  if (!zTouch && !intervalsOverlap(a.zMinMm, a.zMaxMm, b.zMinMm, b.zMaxMm)) return false;
  if (!xTouch && !intervalsOverlap(a.xMinMm, a.xMaxMm, b.xMinMm, b.xMaxMm)) return false;
  if (
    !altTouch &&
    !intervalsOverlap(a.altitudeMinMm, a.altitudeMaxMm, b.altitudeMinMm, b.altitudeMaxMm)
  )
    return false;

  return true;
}

export function resolveHitLocation(input: HitInput): HitResult {
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
