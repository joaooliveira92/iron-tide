import { densifyEdge, type Position } from "../../src/renderer/components/globe-spike/densify.ts";

export type { Position };

export const MAX_MERCATOR_LATITUDE = 85.0511287798066;
export const EARTH_RADIUS_METRES = 6371008.8;
const DEGREES = Math.PI / 180;
const METRES_PER_DEGREE = 111320;

export function wrapLongitude(longitude: number): number {
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

export function shortestLongitudeDelta(from: number, to: number): number {
  const delta = (((to - from + 180) % 360) + 360) % 360;
  return delta - 180 === -180 ? 180 : delta - 180;
}

export function clampToMercator(position: Position): Position {
  return [
    position[0],
    Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, position[1])),
  ];
}

function isCanonical(a: Position, b: Position): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
}

export function densifyEdgeAcrossAntimeridian(
  from: Position,
  to: Position,
  toleranceMetres: number,
): readonly Position[] {
  const forward = isCanonical(from, to);
  const start = forward ? from : to;
  const end = forward ? to : from;
  const delta = shortestLongitudeDelta(start[0], end[0]);
  const unwrappedEnd: Position = [start[0] + delta, end[1]];
  const points = densifyEdge(start, unwrappedEnd, toleranceMetres);
  const startsAtStart = points[0]?.[0] === start[0];
  const ordered = startsAtStart ? points : [...points].reverse();
  const wrapped = ordered.map((point, index): Position => {
    if (index === 0) return start;
    if (index === ordered.length - 1) return end;
    return [wrapLongitude(point[0]), point[1]];
  });
  return forward ? wrapped : wrapped.reverse();
}

export function densifyRingLonLat(
  ring: readonly Position[],
  toleranceMetres: number,
): readonly Position[] {
  const out: Position[] = [];
  for (let index = 0; index + 1 < ring.length; index++) {
    const edge = densifyEdgeAcrossAntimeridian(
      ring[index] as Position,
      ring[index + 1] as Position,
      toleranceMetres,
    );
    for (let k = index === 0 ? 0 : 1; k < edge.length; k++) out.push(edge[k] as Position);
  }
  return out;
}

export function metresBetween(a: Position, b: Position): number {
  const meanLatitude = ((a[1] + b[1]) / 2) * DEGREES;
  const dx = shortestLongitudeDelta(a[0], b[0]) * Math.cos(meanLatitude) * METRES_PER_DEGREE;
  const dy = (b[1] - a[1]) * METRES_PER_DEGREE;
  return Math.hypot(dx, dy);
}

export function mercatorMetres(position: Position): readonly [number, number] {
  const latitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, position[1]));
  return [
    EARTH_RADIUS_METRES * position[0] * DEGREES,
    EARTH_RADIUS_METRES * Math.log(Math.tan(Math.PI / 4 + (latitude * DEGREES) / 2)),
  ];
}

export function distanceToSegmentMetres(point: Position, a: Position, b: Position): number {
  const [px, py] = mercatorMetres(point);
  const [ax, ay] = mercatorMetres(a);
  const [bx, by] = mercatorMetres(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const scale = Math.cos(point[1] * DEGREES);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * scale;
}

export function distanceToPolylineMetres(point: Position, line: readonly Position[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index + 1 < line.length; index++) {
    best = Math.min(
      best,
      distanceToSegmentMetres(point, line[index] as Position, line[index + 1] as Position),
    );
  }
  return best;
}

export function pointInRing(point: Position, ring: readonly Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Position;
    const [xj, yj] = ring[j] as Position;
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function interpolateLonLat(a: Position, b: Position, t: number): Position {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function metresPerPixelAtZoom(zoom: number, latitude: number): number {
  return (2 * Math.PI * EARTH_RADIUS_METRES * Math.cos(latitude * DEGREES)) / (512 * 2 ** zoom);
}
