import type { RouteEdgeSemantics } from "./overlay-contract.js";

const EARTH_RADIUS_METRES = 6371008.8;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normaliseLongitude(value: number): number {
  const wrapped = ((value + 180) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function unwrapRoute(
  points: readonly (readonly [number, number])[],
): readonly (readonly [number, number])[] {
  const out: [number, number][] = [];
  let previous: number | null = null;
  for (const [lon, lat] of points) {
    let next = lon;
    if (previous !== null) {
      while (next - previous > 180) next -= 360;
      while (next - previous < -180) next += 360;
    }
    out.push([next, lat]);
    previous = next;
  }
  return out;
}

function greatCirclePoint(
  from: readonly [number, number],
  to: readonly [number, number],
  fraction: number,
): readonly [number, number] {
  const lat1 = radians(from[1]);
  const lon1 = radians(from[0]);
  const lat2 = radians(to[1]);
  const lon2 = radians(to[0]);
  const delta = Math.acos(
    Math.min(
      1,
      Math.max(
        -1,
        Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1),
      ),
    ),
  );
  if (delta < 1e-9) return [from[0], from[1]];
  const a = Math.sin((1 - fraction) * delta) / Math.sin(delta);
  const b = Math.sin(fraction * delta) / Math.sin(delta);
  const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
  const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
  const z = a * Math.sin(lat1) + b * Math.sin(lat2);
  return [degrees(Math.atan2(y, x)), degrees(Math.atan2(z, Math.hypot(x, y)))];
}

function rhumbPoint(
  from: readonly [number, number],
  to: readonly [number, number],
  fraction: number,
): readonly [number, number] {
  const lat1 = radians(from[1]);
  const lat2 = radians(to[1]);
  const lon1 = radians(from[0]);
  const lon2 = radians(to[0]);
  const deltaLon = lon2 - lon1;
  const deltaLat = lat2 - lat1;
  const projectedDelta = Math.log(
    Math.tan(Math.PI / 4 + lat2 / 2) / Math.tan(Math.PI / 4 + lat1 / 2),
  );
  if (Math.abs(projectedDelta) < 1e-12) {
    return [degrees(lon1 + fraction * deltaLon), degrees(lat1 + fraction * deltaLat)];
  }
  const projected = Math.log(Math.tan(Math.PI / 4 + lat1 / 2)) + fraction * projectedDelta;
  const lat = 2 * Math.atan(Math.exp(projected)) - Math.PI / 2;
  return [degrees(lon1 + fraction * deltaLon), degrees(lat)];
}

function segmentSamples(
  from: readonly [number, number],
  to: readonly [number, number],
  semantics: RouteEdgeSemantics,
): number {
  if (semantics === "lonlat-linear") return 1;
  const lat = radians((from[1] + to[1]) / 2);
  const dx = (to[0] - from[0]) * Math.cos(lat);
  const dy = to[1] - from[1];
  const metres = Math.hypot(dx, dy) * (Math.PI / 180) * EARTH_RADIUS_METRES;
  return Math.max(1, Math.min(256, Math.ceil(metres / 25_000)));
}

export function routeCoordinates(
  points: readonly (readonly [number, number])[],
  semantics: RouteEdgeSemantics,
): readonly (readonly [number, number])[] {
  const unwrapped = unwrapRoute(points);
  if (semantics === "lonlat-linear" || unwrapped.length < 2) return unwrapped;
  const out: [number, number][] = [];
  for (let index = 0; index + 1 < unwrapped.length; index++) {
    const from = unwrapped[index] as readonly [number, number];
    const to = unwrapped[index + 1] as readonly [number, number];
    const samples = segmentSamples(from, to, semantics);
    if (index === 0) out.push([from[0], from[1]]);
    for (let sample = 1; sample <= samples; sample++) {
      const fraction = sample / samples;
      const point =
        semantics === "great-circle"
          ? greatCirclePoint(from, to, fraction)
          : rhumbPoint(from, to, fraction);
      const previous = out[out.length - 1];
      const lon =
        previous === undefined
          ? point[0]
          : point[0] + 360 * Math.round((previous[0] - point[0]) / 360);
      out.push([lon, point[1]]);
    }
  }
  return out;
}

export function normaliseRoutePoint(point: readonly [number, number]): readonly [number, number] {
  return [normaliseLongitude(point[0]), point[1]];
}
