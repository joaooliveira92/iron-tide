import { interpolateLonLat, metresBetween, pointInRing, type Position } from "./geodesy.ts";

export type LandTest = (position: Position) => boolean;

export interface WaterInterval {
  readonly startMetres: number;
  readonly endMetres: number;
}

export interface TransectMeasurement {
  readonly lengthMetres: number;
  readonly startsOnLand: boolean;
  readonly endsOnLand: boolean;
  readonly water: readonly WaterInterval[];
  readonly longestWaterMetres: number;
  readonly longest: WaterInterval | null;
}

export interface IndexedPolygon {
  readonly rings: readonly (readonly Position[])[];
  readonly bounds: readonly [number, number, number, number];
}

export function indexPolygons(
  polygons: readonly (readonly (readonly Position[])[])[],
): readonly IndexedPolygon[] {
  return polygons.map((rings) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of rings[0] ?? []) {
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    }
    return { rings, bounds: [minX, minY, maxX, maxY] as const };
  });
}

export function landTestFromPolygons(indexed: readonly IndexedPolygon[]): LandTest {
  return (position) => {
    for (const polygon of indexed) {
      const [minX, minY, maxX, maxY] = polygon.bounds;
      if (position[0] < minX || position[0] > maxX || position[1] < minY || position[1] > maxY)
        continue;
      const [outer, ...holes] = polygon.rings;
      if (outer === undefined || !pointInRing(position, outer)) continue;
      if (holes.some((hole) => pointInRing(position, hole))) continue;
      return true;
    }
    return false;
  };
}

export function measureTransect(
  isLand: LandTest,
  from: Position,
  to: Position,
  stepMetres: number,
): TransectMeasurement {
  const lengthMetres = metresBetween(from, to);
  const count = Math.max(2, Math.ceil(lengthMetres / stepMetres));
  const water: WaterInterval[] = [];
  let open: number | null = null;
  const startsOnLand = isLand(from);
  const endsOnLand = isLand(to);
  for (let step = 0; step <= count; step++) {
    const t = step / count;
    const here =
      step === 0
        ? startsOnLand
        : step === count
          ? endsOnLand
          : isLand(interpolateLonLat(from, to, t));
    const distance = t * lengthMetres;
    if (!here && open === null) open = distance;
    if (here && open !== null) {
      water.push({ startMetres: open, endMetres: distance });
      open = null;
    }
  }
  if (open !== null) water.push({ startMetres: open, endMetres: lengthMetres });
  let longest: WaterInterval | null = null;
  for (const interval of water) {
    if (
      longest === null ||
      interval.endMetres - interval.startMetres > longest.endMetres - longest.startMetres
    ) {
      longest = interval;
    }
  }
  return {
    lengthMetres,
    startsOnLand,
    endsOnLand,
    water,
    longestWaterMetres: longest === null ? 0 : longest.endMetres - longest.startMetres,
    longest,
  };
}
