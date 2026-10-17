// S-1 (ship readiness and maintenance): the single, versioned per-ship
// maintenance formula and its readiness-state multipliers (ADR-0223, decision
// request 0007-A). The formula and its constants live here so the maintenance
// phase, the opening briefing and the player projection all read one source.
//
// Grounding: repair ≈ 2× active and mothballing halts repair (manual p.51);
// mothballed maintenance is half (manual p.30). The reserve and working-up
// multipliers have no manual source and are admitted balance choices (ADR-0213,
// `balance_adjustment`) — tune them here, never inside a phase.
//
// `campaign` is renderer-reachable, so this stays plain TypeScript (no `effect`).
import { SafeInt } from "@bluewave/contracts";
import type { ShipReadinessState } from "./readiness.js";

export const MAINTENANCE_FORMULA_ID = "maintenance_v2";
export const MAINTENANCE_FORMULA_VERSION = "2.0.0";

/** Active maintenance is the base rate (multiplier 1.00). */
export const MAINTENANCE_ACTIVE_MULTIPLIER_BP = SafeInt(10_000);
/** Working-up ships are in commission at the base rate (balance_adjustment, ADR-0213). */
export const MAINTENANCE_WORKING_UP_MULTIPLIER_BP = SafeInt(10_000);
/** Reserve is cheaper than active (balance_adjustment, ADR-0213). */
export const MAINTENANCE_RESERVE_MULTIPLIER_BP = SafeInt(7_500);
/** Mothballed = half active (manual p.30; grounded). */
export const MAINTENANCE_MOTHBALLED_MULTIPLIER_BP = SafeInt(5_000);
/** Repair ≈ 2× active (manual p.51; grounded). */
export const MAINTENANCE_REPAIR_MULTIPLIER_BP = SafeInt(20_000);

/** The readiness state's maintenance multiplier, in basis points. */
const MULTIPLIER_BP: Record<ShipReadinessState, SafeInt> = {
  ACTIVE: MAINTENANCE_ACTIVE_MULTIPLIER_BP,
  WORKING_UP: MAINTENANCE_WORKING_UP_MULTIPLIER_BP,
  RESERVE: MAINTENANCE_RESERVE_MULTIPLIER_BP,
  MOTHBALLED: MAINTENANCE_MOTHBALLED_MULTIPLIER_BP,
  REPAIR: MAINTENANCE_REPAIR_MULTIPLIER_BP,
};

export function maintenanceMultiplierBp(readiness: ShipReadinessState): SafeInt {
  return MULTIPLIER_BP[readiness];
}

/**
 * The one shared per-ship maintenance formula (ADR-0223): the base rate
 * (`floor(hitPoints * 10 / 100)`) scaled by the readiness state's multiplier,
 * with one explicit floor rounding. Integer-only and deterministic.
 */
export function shipMaintenanceCost(hitPoints: SafeInt, readiness: ShipReadinessState): SafeInt {
  const base = SafeInt.div(SafeInt.mul(hitPoints, SafeInt(10)), SafeInt(100), "floor");
  return SafeInt.div(
    SafeInt.mul(base, maintenanceMultiplierBp(readiness)),
    SafeInt(10_000),
    "floor",
  );
}
