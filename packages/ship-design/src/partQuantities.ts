/**
 * Basis-driven quantities (ship-part-model SPM-R5, SPM-R13, SPM-R14). A part's quantity
 * component scales by its declared **application basis** and the loadout entry's counts —
 * never by the part family or the quantity kind. Shared by every read-path slice (guns,
 * torpedo launchers, and the families ticket 05 adds).
 */
import type {
  ApplicationBasis,
  QuantityComponentData,
  QuantityKind,
} from "@bluewave/content-schema";

/**
 * The multiplier for one quantity component at an entry's counts (SPM-R13):
 * `PER_LOADOUT_ENTRY` → 1, `PER_PART_UNIT` → `mountCount`,
 * `PER_CONTAINED_UNIT` → `mountCount × containedPerUnit` (a gun mount's `gunsPerMount`).
 */
export function basisMultiplier(
  basis: ApplicationBasis,
  mountCount: number,
  containedPerUnit: number,
): number {
  switch (basis) {
    case "PER_LOADOUT_ENTRY":
      return 1;
    case "PER_PART_UNIT":
      return mountCount;
    case "PER_CONTAINED_UNIT":
      return mountCount * containedPerUnit;
  }
}

/** Which part of a translated entry a quantity line belongs to. */
export type QuantityScope = "mount" | "gun" | "launcher" | "fitting";

/** One compiled quantity line: value × multiplier = contribution (SPM-R13/R14). */
export interface QuantityLine {
  readonly id: string;
  readonly kind: QuantityKind;
  readonly scope: QuantityScope;
  /** The part the component belongs to. */
  readonly part: string;
  readonly value: number;
  readonly basis: ApplicationBasis;
  readonly multiplier: number;
  readonly contribution: number;
}

/** Compile one part's quantity components at an entry's counts (SPM-R13). */
export function quantityLines(
  quantities: readonly QuantityComponentData[],
  scope: QuantityScope,
  part: string,
  mountCount: number,
  containedPerUnit: number,
): QuantityLine[] {
  return quantities.map((q) => {
    const multiplier = basisMultiplier(q.basis, mountCount, containedPerUnit);
    return {
      id: q.id,
      kind: q.kind,
      scope,
      part,
      value: q.value,
      basis: q.basis,
      multiplier,
      contribution: q.value * multiplier,
    };
  });
}

/** The sum of the lines' contributions of one kind (0 when none is declared). */
export function totalOf(lines: readonly QuantityLine[], kind: QuantityKind): number {
  return lines.reduce((sum, line) => (line.kind === kind ? sum + line.contribution : sum), 0);
}
