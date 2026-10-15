//packages/combat/src/damage/magazineHazard.ts
// DESIGN-41 §10 item 1 — Magazine/ammunition secondary hazard. This stage
// evaluates whether a hit that reaches a magazine compartment triggers a
// detonation. Other secondary hazards (fuel, torpedo warheads) are deferred
// to M3/C-5.
//
// Rules (§10):
//   - Full penetration of a magazine zone with critical penetration outcome
//     has high detonation probability
//   - Detonation creates a new causal damage package (not a silent alteration)
//   - Keyed RNG stream: "battle/ship/damage/magazine"
//
// Pure/deterministic: uses keyed RNG function, no ambient I/O/clock/random.

// ---------------------------------------------------------------------------
// Constants

// Base detonation probability for a magazine hit meeting all conditions.
// 8_000 bp = 80% base chance when full penetration + critical outcome.
const BASE_DETONATION_BP = 8_000;

// Structural and flotation damage from a magazine detonation.
const DETONATION_STRUCTURAL_DAMAGE = 50_000;
const DETONATION_FLOTATION_DAMAGE = 30_000;

// The set of penetration outcomes that qualify for detonation risk.
const DETONATION_OUTCOMES = new Set(["FULL_PENETRATION", "CRITICAL_PENETRATION"]);

// The set of hit zone types considered magazine/ammunition compartments.
const MAGAZINE_ZONE_TYPES = new Set([
  "MAGAZINE",
  "SHELL_ROOM",
  "PROPELLANT_MAGAZINE",
  "AMMUNITION_HOLD",
]);

// ---------------------------------------------------------------------------
// Input/Output types

export interface MagazineHazardInput {
  /** Whether the hit zone contains a magazine/ammunition compartment. */
  hasMagazineInZone: boolean;
  /** The penetration outcome from the protection interaction stage. */
  penetrationOutcome: string;
  /** The type of the hit zone. */
  hitZoneType: string;
}

export interface MagazineHazardResult {
  /** Whether the magazine detonated. */
  magazineDetonated: boolean;
  /** Structural damage inflicted by the detonation. */
  structuralDamage: number;
  /** Flotation damage inflicted by the detonation. */
  flotationDamage: number;
  /** Hazard type identifier: "MAGAZINE_DETONATION" or "NONE". */
  hazardType: string;
}

// ---------------------------------------------------------------------------
// Evaluator

/**
 * Determine whether the hit zone contains a magazine/ammunition compartment.
 * Matches against known magazine zone type identifiers.
 */
export function isMagazineZoneType(hitZoneType: string): boolean {
  return MAGAZINE_ZONE_TYPES.has(hitZoneType);
}

/**
 * Evaluate whether a hit triggers a magazine/ammunition detonation (§10).
 *
 * Full penetration of a magazine zone with a critical penetration outcome
 * carries a high probability of detonation. The RNG determines the actual
 * outcome. If detonation occurs, it creates a secondary-hazard damage
 * package with structural and flotation damage.
 *
 * @param input - Magazine hazard conditions.
 * @param keyedRng - Deterministic RNG function keyed by stream name,
 *   returns a float in [0, 1).
 * @returns A MagazineHazardResult describing whether detonation occurred.
 */
export function evaluateMagazineHazard(
  input: MagazineHazardInput,
  keyedRng: (stream: string) => number,
): MagazineHazardResult {
  const { hasMagazineInZone, penetrationOutcome, hitZoneType } = input;

  // Check preconditions: magazine present in zone
  if (!hasMagazineInZone) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  // Check zone type is a recognized magazine type
  if (!MAGAZINE_ZONE_TYPES.has(hitZoneType)) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  // Check penetration outcome qualifies for detonation risk
  if (!DETONATION_OUTCOMES.has(penetrationOutcome)) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  // RNG determines detonation
  const draw = keyedRng("battle/ship/damage/magazine");
  const drawBp = Math.floor(draw * 10_000);

  const magazineDetonated = drawBp < BASE_DETONATION_BP;

  if (!magazineDetonated) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  return {
    magazineDetonated: true,
    structuralDamage: DETONATION_STRUCTURAL_DAMAGE,
    flotationDamage: DETONATION_FLOTATION_DAMAGE,
    hazardType: "MAGAZINE_DETONATION",
  };
}
