//packages/combat/src/damage/immediateFireFlooding.ts
// DESIGN-41 §9 — Immediate fire and flooding source creation. This stage creates
// FireSourceRecord and FloodingSourceRecord entries from a qualified hit; it does
// NOT resolve progressive fire/flooding effects (deferred to M3/C-5).
//
// Fire creation rules (§9):
//   - Requires ignition source (full penetration or critical penetration outcome)
//   - Requires combustible material in the hit zone
//   - Requires oxygen available
//   - Ship-type fire-risk multiplier (bp) sets the base probability
//   - Keyed RNG stream: "battle/ship/damage/fire_creation"
//
// Flooding creation rules (§9):
//   - Requires hull breach (full penetration at or below waterline)
//   - Requires open water route to the sea
//   - Rate proportional to breach size estimate
//   - Keyed RNG stream: "battle/ship/damage/flooding_creation"
//
// A single hit may create neither, one, or both effects.
// Pure/deterministic: uses keyed RNG function, no ambient I/O/clock/random.

import { FIRE_SOURCE_CREATED, FLOODING_SOURCE_CREATED } from "./reasonCodes.js";
import type { FireSourceRecord, FloodingSourceRecord } from "./state.js";

// ---------------------------------------------------------------------------
// Ship-type fire-risk multipliers per DESIGN-41 §20 (in basis points).
// These represent the base probability that a qualified hit starts a fire.
// 10_000 bp = 100% probability.
export const SHIP_TYPE_FIRE_RISK_BP: Record<string, number> = {
  ORDINARY: 10_000,
  CARRIER: 15_000,
  PRE_DREADNOUGHT: 12_000,
  BATTLE_CRUISER: 10_000,
  DESTROYER: 8_000,
  CRUISER: 9_000,
};

// Default fire-risk multiplier for unknown types.
const DEFAULT_FIRE_RISK_BP = 10_000;

// Base fire intensity for a newly created fire source (5000 bp = 50%).
const BASE_FIRE_INTENSITY_BP = 5_000;

// Default flooding rate (kg/min) for a basic breach.
const BASE_FLOODING_RATE_KG_MIN = 800;

// The set of penetration outcomes that qualify as ignition sources.
const IGNITION_OUTCOMES = new Set(["FULL_PENETRATION", "CRITICAL_PENETRATION"]);

// ADR-0098 (post-ADR-0094 lethality rebalance): a hull breach floods on a full
// penetration at the historical 80% chance, and on a BOUNDED partial
// penetration at a lower chance. Only a breach (`hullBreach`), which the impact
// seam sets for waterline zones, reaches this stage; the partial case never
// reaches the full-penetration chance. BALANCE_TARGET.
const FLOODING_CHANCE_BP: Record<string, number> = {
  FULL_PENETRATION: 8_000,
  PARTIAL_PENETRATION: 3_000,
};

// ---------------------------------------------------------------------------
// Input types

export interface FireCreationInput {
  /** Id of the hit location zone/compartment where fire could start. */
  locationId: string;
  /** The penetration outcome from the protection interaction stage. */
  penetrationOutcome: string;
  /** The type of the hit zone (e.g. "BELT", "DECK", "SUPERSTRUCTURE"). */
  hitZoneType: string;
  /** Ship type classification for fire-risk multiplier lookup. */
  shipType: string;
  /** Whether the hit zone contains combustible material. */
  hasCombustible: boolean;
  /** Whether oxygen is available at the hit location. */
  hasOxygen: boolean;
}

export interface FloodingCreationInput {
  /** Id of the compartment where flooding could originate. */
  compartmentId: string;
  /** The penetration outcome from the protection interaction stage. */
  penetrationOutcome: string;
  /** Whether the hit caused a hull breach (full penetration at/below waterline). */
  hullBreach: boolean;
  /** Whether there is an open water route from the compartment to the sea. */
  hasWaterRoute: boolean;
}

// ---------------------------------------------------------------------------
// Output types — FireSourceRecord and FloodingSourceRecord are defined in state.ts.
// Re-exported here for convenience.
export type { FireSourceRecord, FloodingSourceRecord };

// ---------------------------------------------------------------------------
// Evaluators

/**
 * Get the fire-risk multiplier for a given ship type.
 * Returns 10_000 bp (100%) for unknown types.
 */
export function getFireRiskBp(shipType: string): number {
  return SHIP_TYPE_FIRE_RISK_BP[shipType] ?? DEFAULT_FIRE_RISK_BP;
}

/**
 * Evaluate whether a hit creates a fire source (§9).
 *
 * @param input - Fire creation conditions.
 * @param keyedRng - Deterministic RNG function keyed by stream name,
 *   returns a float in [0, 1).
 * @returns A FireSourceRecord if a fire starts, or null if no fire.
 */
export function evaluateFireCreation(
  input: FireCreationInput,
  keyedRng: (stream: string) => number,
): FireSourceRecord | null {
  const { locationId, penetrationOutcome, shipType, hasCombustible, hasOxygen } = input;

  // Requirement: ignition source (full or critical penetration)
  if (!IGNITION_OUTCOMES.has(penetrationOutcome)) {
    return null;
  }

  // Requirement: combustible material
  if (!hasCombustible) {
    return null;
  }

  // Requirement: oxygen available
  if (!hasOxygen) {
    return null;
  }

  // Base probability via ship-type fire-risk multiplier
  const fireRiskBp = getFireRiskBp(shipType);

  // RNG determines if fire starts: draw scaled to [0, 10_000) compared to risk
  const draw = keyedRng("battle/ship/damage/fire_creation");
  const drawBp = Math.floor(draw * 10_000);

  if (drawBp >= fireRiskBp) {
    return null; // fire did not start
  }

  // Fire starts with base intensity
  return {
    locationId,
    intensityBp: BASE_FIRE_INTENSITY_BP,
    cause: FIRE_SOURCE_CREATED,
  };
}

/**
 * Evaluate whether a hit creates a flooding source (§9).
 *
 * @param input - Flooding creation conditions.
 * @param keyedRng - Deterministic RNG function keyed by stream name,
 *   returns a float in [0, 1).
 * @returns A FloodingSourceRecord if flooding starts, or null if no flooding.
 */
export function evaluateFloodingCreation(
  input: FloodingCreationInput,
  keyedRng: (stream: string) => number,
): FloodingSourceRecord | null {
  const { compartmentId, penetrationOutcome, hullBreach, hasWaterRoute } = input;

  // Requirement: hull breach (full penetration at or below waterline)
  if (!hullBreach) {
    return null;
  }

  // Requirement: a penetrating outcome that qualifies as a flooding breach.
  // ADR-0098: full penetration keeps the 80% chance; a bounded partial
  // penetration floods at a lower chance. Non-breach outcomes never reach here.
  const floodingChanceBp = FLOODING_CHANCE_BP[penetrationOutcome];
  if (floodingChanceBp === undefined) {
    return null;
  }

  // Requirement: open water route
  if (!hasWaterRoute) {
    return null;
  }

  // RNG determines if flooding starts based on breach characteristics
  const draw = keyedRng("battle/ship/damage/flooding_creation");
  const drawBp = Math.floor(draw * 10_000);

  if (drawBp >= floodingChanceBp) {
    return null; // flooding did not start (unusual — the hole exists but is sealed or below waterline only partially)
  }

  // Flooding starts with base rate
  return {
    compartmentId,
    rateKgMin: BASE_FLOODING_RATE_KG_MIN,
    cause: FLOODING_SOURCE_CREATED,
  };
}
