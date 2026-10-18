import type { ArmourRegionId, ArmourSchemeDef } from "@bluewave/ship-design";

/** A rough side view of a scheme: where its plates sit on a stylised hull. Illustrative, not to scale. */
export interface SchemeDiagram {
  readonly width: number;
  readonly height: number;
  /** The hull outline, drawn as a polygon of points. */
  readonly hull: readonly (readonly [number, number])[];
  readonly plates: readonly SchemePlate[];
}

export interface SchemePlate {
  readonly region: ArmourRegionId;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const WIDTH = 200;
const HEIGHT = 64;
const HULL: SchemeDiagram["hull"] = [
  [4, 22],
  [196, 22],
  [186, 52],
  [14, 52],
];
const WATERLINE = 40;

/**
 * The plates a scheme draws, one per region it fits. Amidships (the citadel) spans the middle; "ends" regions sit
 * fore and aft of it; an all-or-nothing scheme draws only the citadel. Pure and deterministic.
 */
export function schemeDiagram(scheme: ArmourSchemeDef): SchemeDiagram {
  const citadel: readonly [number, number] = scheme.citadelOnly ? [60, 140] : [40, 160];
  const [c1, c2] = citadel;
  const plate = (region: ArmourRegionId): SchemePlate[] => {
    switch (region) {
      case "BELT_MAIN":
        return [{ region, x1: c1, y1: WATERLINE - 6, x2: c2, y2: WATERLINE + 8 }];
      case "BELT_UPPER":
        return [{ region, x1: c1, y1: 24, x2: c2, y2: WATERLINE - 6 }];
      case "BELT_ENDS":
        return [{ region, x1: 12, y1: WATERLINE - 6, x2: c1, y2: WATERLINE + 8 }];
      case "DECK_MAIN":
        return [{ region, x1: c1, y1: 24, x2: c2, y2: 24 }];
      case "DECK_SLOPE":
        return [{ region, x1: c1, y1: 24, x2: c1 + 12, y2: WATERLINE + 4 }];
      case "DECK_EXTENDED":
        return [{ region, x1: 8, y1: 24, x2: c1, y2: 24 }];
      default:
        return [];
    }
  };
  return {
    width: WIDTH,
    height: HEIGHT,
    hull: HULL,
    plates: scheme.layout.flatMap(plate),
  };
}
