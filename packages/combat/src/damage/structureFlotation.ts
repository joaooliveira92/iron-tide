// DESIGN-41 §8 — Structure & flotation damage resolution.
// Pure formulas:
//   structuralIntegrityAfter = max(0, before - structuralDamage)
//   flotationReserveAfter = max(0, before - immediateFlotationDamage)
// Both inputs and outputs are integer fixed-point (µm-equivalent or kg).
// Pure/deterministic: no ambient I/O/clock/random.

// Input/Output types

export interface StructureFlotationInput {
  /** Structural damage inflicted (integer, non-negative). */
  structuralDamage: number;
  /** Immediate flotation damage inflicted (integer, non-negative). */
  flotationDamage: number;
  /** Current structural integrity before damage (integer, non-negative). */
  currentStructuralIntegrity: number;
  /** Current flotation reserve before damage (integer, non-negative). */
  currentFlotationReserve: number;
}

export interface StructureFlotationResult {
  /** Structural integrity after damage, floored at 0. */
  structuralIntegrityAfter: number;
  /** Flotation reserve after damage, floored at 0. */
  flotationReserveAfter: number;
  /** The structural damage applied before capping (for event records). */
  uncappedStructuralDamage: number;
  /** The flotation damage applied before capping (for event records). */
  uncappedFlotationDamage: number;
}

// Resolver

/**
 * Resolve structural and flotation damage.
 *
 * Per DESIGN-41 §8:
 *   structuralIntegrityAfter = max(0, currentStructuralIntegrity - structuralDamage)
 *   flotationReserveAfter = max(0, currentFlotationReserve - immediateFlotationDamage)
 *
 * Both `uncapped*` fields preserve the raw damage amounts for event records,
 * even when the current value would go negative (excess damage is recorded
 * for progressive effects like flooding progression).
 *
 * @param input - The structure/flotation damage input.
 * @returns The computed result.
 */
export function resolveStructureFlotation(
  input: StructureFlotationInput,
): StructureFlotationResult {
  const { structuralDamage, flotationDamage, currentStructuralIntegrity, currentFlotationReserve } =
    input;

  // Floor at 0 per §8
  const structuralIntegrityAfter = Math.max(0, currentStructuralIntegrity - structuralDamage);
  const flotationReserveAfter = Math.max(0, currentFlotationReserve - flotationDamage);

  // Unaffected: raw damage amounts (may exceed current values)
  const uncappedStructuralDamage = structuralDamage;
  const uncappedFlotationDamage = flotationDamage;

  return {
    structuralIntegrityAfter,
    flotationReserveAfter,
    uncappedStructuralDamage,
    uncappedFlotationDamage,
  };
}
