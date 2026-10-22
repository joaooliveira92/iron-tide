import { KNOTS_TO_UMS, MM_TO_UM } from "@bluewave/contracts";

export { KNOTS_TO_UMS, MM_TO_UM };

export function knotsToUms(knots: number): number {
  return knots * KNOTS_TO_UMS;
}

export function mmToUm(mm: number): number {
  return mm * MM_TO_UM;
}

export function umsToKnots(ums: number): number {
  return ums / KNOTS_TO_UMS;
}

export function umToMm(um: number): number {
  return um / MM_TO_UM;
}
