import { CombatInvariantError } from "../errors.js";
import { pointInPolygon, positionMetres, segmentsIntersect } from "./geometry.js";
import {
  TERRAIN_COORDINATE_LIMIT_M,
  TERRAIN_QUERY_LIMIT_M,
  TERRAIN_QUERY_OUT_OF_RANGE,
  type CoastPoint,
  type Position,
  type TerrainPoint,
  type TerrainView,
} from "./model.js";

function withinCoordinateBox(point: TerrainPoint): boolean {
  return (
    Math.abs(point.xM) <= TERRAIN_COORDINATE_LIMIT_M &&
    Math.abs(point.yM) <= TERRAIN_COORDINATE_LIMIT_M
  );
}

function landContains(terrain: TerrainView, point: TerrainPoint): boolean {
  if (!withinCoordinateBox(point)) return false;
  return terrain.land.some((polygon) => pointInPolygon(point, polygon.vertices));
}

export function pointInLand(terrain: TerrainView, position: Position): boolean {
  return landContains(terrain, positionMetres(position));
}

export function pointInNoGoZone(terrain: TerrainView, position: Position): boolean {
  const point = positionMetres(position);
  if (landContains(terrain, point)) return true;
  return terrain.exclusions.some((zone) => {
    const dx = point.xM - zone.xM;
    const dy = point.yM - zone.yM;
    if (Math.abs(dx) > zone.radiusM || Math.abs(dy) > zone.radiusM) return false;
    return dx * dx + dy * dy <= zone.radiusM * zone.radiusM;
  });
}

function segmentOutsideBox(p: TerrainPoint, q: TerrainPoint): boolean {
  const limit = TERRAIN_COORDINATE_LIMIT_M;
  return (
    (p.xM > limit && q.xM > limit) ||
    (p.xM < -limit && q.xM < -limit) ||
    (p.yM > limit && q.yM > limit) ||
    (p.yM < -limit && q.yM < -limit)
  );
}

function assertQueryRange(point: TerrainPoint): void {
  if (Math.abs(point.xM) > TERRAIN_QUERY_LIMIT_M || Math.abs(point.yM) > TERRAIN_QUERY_LIMIT_M) {
    throw new CombatInvariantError({
      message: "terrain query position is beyond the supported range",
      code: TERRAIN_QUERY_OUT_OF_RANGE,
      context: { xM: point.xM, yM: point.yM, limitM: TERRAIN_QUERY_LIMIT_M },
    });
  }
}

export function segmentCrossesLand(terrain: TerrainView, from: Position, to: Position): boolean {
  const p = positionMetres(from);
  const q = positionMetres(to);
  if (terrain.land.length === 0 || segmentOutsideBox(p, q)) return false;
  assertQueryRange(p);
  assertQueryRange(q);
  if (landContains(terrain, p) || landContains(terrain, q)) return true;
  return terrain.land.some((polygon) =>
    polygon.vertices.some((a, index) =>
      segmentsIntersect(
        p,
        q,
        a,
        polygon.vertices[(index + 1) % polygon.vertices.length] as TerrainPoint,
      ),
    ),
  );
}

function floorDiv(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return numerator % denominator !== 0n && numerator < 0n !== denominator < 0n
    ? quotient - 1n
    : quotient;
}

function nearestOnEdge(point: TerrainPoint, a: TerrainPoint, b: TerrainPoint): TerrainPoint {
  const dx = b.xM - a.xM;
  const dy = b.yM - a.yM;
  const lengthSquared = dx * dx + dy * dy;
  const dot = (point.xM - a.xM) * dx + (point.yM - a.yM) * dy;
  if (lengthSquared === 0 || dot <= 0) return a;
  if (dot >= lengthSquared) return b;
  const dotBig = BigInt(dot);
  const lengthBig = BigInt(lengthSquared);
  return {
    xM: a.xM + Number(floorDiv(dotBig * BigInt(dx), lengthBig)),
    yM: a.yM + Number(floorDiv(dotBig * BigInt(dy), lengthBig)),
  };
}

export function nearestCoastPoint(
  terrain: TerrainView,
  position: Position,
): CoastPoint | undefined {
  const point = positionMetres(position);
  assertQueryRange(point);
  let best: CoastPoint | undefined;
  for (const polygon of terrain.land) {
    const count = polygon.vertices.length;
    for (let index = 0; index < count; index += 1) {
      const a = polygon.vertices[index] as TerrainPoint;
      const b = polygon.vertices[(index + 1) % count] as TerrainPoint;
      const nearest = nearestOnEdge(point, a, b);
      const dx = point.xM - nearest.xM;
      const dy = point.yM - nearest.yM;
      const distanceSquaredM = dx * dx + dy * dy;
      if (best === undefined || distanceSquaredM < best.distanceSquaredM) {
        best = {
          polygonId: polygon.id,
          edgeIndex: index,
          xM: nearest.xM,
          yM: nearest.yM,
          distanceSquaredM,
        };
      }
    }
  }
  return best;
}
