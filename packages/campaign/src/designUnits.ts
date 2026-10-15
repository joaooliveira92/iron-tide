// DESIGN-22 §2 canonical design-unit conversions (ADR-0037).
//
// The compiled `CompiledDesignVersion` carries canonical engine units:
// displacement in kilograms, designed speed in micrometres per second, armor
// thickness in micrometres, and main-gun caliber in micrometres. Content
// authoring (designs.yaml and all design fixtures) stays human-friendly in
// millimetres and knots; the campaign compiler normalizes to the canonical
// units below, and display/projection consumers convert back for presentation.

/** 1 millimetre in micrometres. */
export const MM_TO_UM = 1000;

/** 1 knot in micrometres per second (1 kt = 0.514444 m/s). */
export const KNOTS_TO_UMS = 514_444;

/**
 * Convert an authored design value in knots to canonical micrometres per second.
 */
export function knotsToUms(knots: number): number {
  return knots * KNOTS_TO_UMS;
}

/**
 * Convert an authored design value in millimetres to canonical micrometres.
 */
export function mmToUm(mm: number): number {
  return mm * MM_TO_UM;
}

/**
 * Convert a canonical designed-speed value (µm/s) to display knots.
 */
export function umsToKnots(ums: number): number {
  return ums / KNOTS_TO_UMS;
}

/**
 * Convert a canonical armor/caliber value (µm) to display millimetres.
 */
export function umToMm(um: number): number {
  return um / MM_TO_UM;
}
