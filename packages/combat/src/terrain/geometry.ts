import { CombatInvariantError } from "../errors.js";
import {
  TERRAIN_MICROMETRES_PER_METRE,
  TERRAIN_POSITION_NOT_SAFE_INTEGER,
  type Position,
  type TerrainPoint,
} from "./model.js";

export function floorMetres(micrometres: number): number {
  if (!Number.isSafeInteger(micrometres)) {
    throw new CombatInvariantError({
      message: "terrain positions must be safe integers in micrometres",
      code: TERRAIN_POSITION_NOT_SAFE_INTEGER,
      context: { micrometres },
    });
  }
  const remainder =
    ((micrometres % TERRAIN_MICROMETRES_PER_METRE) + TERRAIN_MICROMETRES_PER_METRE) %
    TERRAIN_MICROMETRES_PER_METRE;
  return (micrometres - remainder) / TERRAIN_MICROMETRES_PER_METRE;
}

export function positionMetres(position: Position): TerrainPoint {
  return { xM: floorMetres(position[0]), yM: floorMetres(position[1]) };
}

export function orientation(a: TerrainPoint, b: TerrainPoint, c: TerrainPoint): number {
  const cross = (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
  return cross > 0 ? 1 : cross < 0 ? -1 : 0;
}

export function onSegment(a: TerrainPoint, b: TerrainPoint, p: TerrainPoint): boolean {
  return (
    orientation(a, b, p) === 0 &&
    p.xM >= Math.min(a.xM, b.xM) &&
    p.xM <= Math.max(a.xM, b.xM) &&
    p.yM >= Math.min(a.yM, b.yM) &&
    p.yM <= Math.max(a.yM, b.yM)
  );
}

export function segmentsIntersect(
  p: TerrainPoint,
  q: TerrainPoint,
  a: TerrainPoint,
  b: TerrainPoint,
): boolean {
  const o1 = orientation(p, q, a);
  const o2 = orientation(p, q, b);
  const o3 = orientation(a, b, p);
  const o4 = orientation(a, b, q);
  if (o1 !== o2 && o3 !== o4) return true;
  return onSegment(p, q, a) || onSegment(p, q, b) || onSegment(a, b, p) || onSegment(a, b, q);
}

export function pointInPolygon(point: TerrainPoint, vertices: readonly TerrainPoint[]): boolean {
  let inside = false;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i] as TerrainPoint;
    const b = vertices[(i + 1) % vertices.length] as TerrainPoint;
    if (onSegment(a, b, point)) return true;
    if (a.yM > point.yM !== b.yM > point.yM) {
      const side = (b.xM - a.xM) * (point.yM - a.yM) - (point.xM - a.xM) * (b.yM - a.yM);
      if (b.yM > a.yM ? side > 0 : side < 0) inside = !inside;
    }
  }
  return inside;
}
