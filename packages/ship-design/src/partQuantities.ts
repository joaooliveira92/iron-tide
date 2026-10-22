import type {
  ApplicationBasis,
  QuantityComponentData,
  QuantityKind,
} from "@bluewave/content-schema";

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

export type QuantityScope = "mount" | "gun" | "launcher" | "fitting";

export interface QuantityLine {
  readonly id: string;
  readonly kind: QuantityKind;
  readonly scope: QuantityScope;
  readonly part: string;
  readonly value: number;
  readonly basis: ApplicationBasis;
  readonly multiplier: number;
  readonly contribution: number;
}

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

export function totalOf(lines: readonly QuantityLine[], kind: QuantityKind): number {
  return lines.reduce((sum, line) => (line.kind === kind ? sum + line.contribution : sum), 0);
}
