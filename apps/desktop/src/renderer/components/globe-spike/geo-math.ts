import { GeoMathError } from "./globe-spike-errors.js";

export const EARTH_RADIUS_METRES = 6371008.8;
export const EARTH_CIRCUMFERENCE_METRES = 2 * Math.PI * EARTH_RADIUS_METRES;
export const TILE_SIZE_PX = 512;
export const VERTICAL_FOV_RADIANS = 0.6435011087932844;
export const MAX_MERCATOR_LATITUDE = 85.0511287798066;
export const BLEND_START_ZOOM = 11;
export const BLEND_END_ZOOM = 12;

const DEGREES = Math.PI / 180;

export type Vec3 = readonly [number, number, number];

export interface BlendRange {
  readonly start: number;
  readonly end: number;
}

export const DEFAULT_BLEND: BlendRange = { start: BLEND_START_ZOOM, end: BLEND_END_ZOOM };

export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new GeoMathError("longitude must be finite");
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

export function clampLatitude(latitude: number): number {
  if (!Number.isFinite(latitude)) throw new GeoMathError("latitude must be finite");
  return Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude));
}

export function metresPerPixel(zoom: number, latitude: number): number {
  return (EARTH_CIRCUMFERENCE_METRES * Math.cos(latitude * DEGREES)) / (TILE_SIZE_PX * 2 ** zoom);
}

export function cameraAltitudeMetres(
  zoom: number,
  latitude: number,
  viewportHeightPx: number,
): number {
  return (
    (metresPerPixel(zoom, latitude) * viewportHeightPx) / (2 * Math.tan(VERTICAL_FOV_RADIANS / 2))
  );
}

export function zoomForCameraAltitude(
  altitudeMetres: number,
  latitude: number,
  viewportHeightPx: number,
): number {
  const mpp = (2 * altitudeMetres * Math.tan(VERTICAL_FOV_RADIANS / 2)) / viewportHeightPx;
  return Math.log2(
    (EARTH_CIRCUMFERENCE_METRES * Math.cos(latitude * DEGREES)) / (TILE_SIZE_PX * mpp),
  );
}

export function lonLatToSphere(longitude: number, latitude: number): Vec3 {
  const lon = longitude * DEGREES;
  const lat = latitude * DEGREES;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

export function sphereToLonLat(point: Vec3): readonly [number, number] {
  const [x, y, z] = point;
  const horizontal = Math.hypot(x, z);
  return [Math.atan2(x, z) / DEGREES, Math.atan2(y, horizontal) / DEGREES];
}

export function lonLatToMercatorPixel(
  longitude: number,
  latitude: number,
  zoom: number,
): readonly [number, number] {
  const world = TILE_SIZE_PX * 2 ** zoom;
  const sine = Math.sin(clampLatitude(latitude) * DEGREES);
  return [
    ((longitude + 180) / 360) * world,
    (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world,
  ];
}

export function mercatorPixelToLonLat(
  x: number,
  y: number,
  zoom: number,
): readonly [number, number] {
  const world = TILE_SIZE_PX * 2 ** zoom;
  return [
    (x / world) * 360 - 180,
    (2 * Math.atan(Math.exp((0.5 - y / world) * 2 * Math.PI)) - Math.PI / 2) / DEGREES,
  ];
}

export function globeBlend(zoom: number, range: BlendRange = DEFAULT_BLEND): number {
  if (!(range.end > range.start)) throw new GeoMathError("blend end must exceed start");
  return Math.max(0, Math.min(1, (range.end - zoom) / (range.end - range.start)));
}

export function maxSegmentAngleRadians(zoom: number, latitude: number, errorPx: number): number {
  const sagitta = errorPx * metresPerPixel(zoom, latitude);
  if (sagitta >= EARTH_RADIUS_METRES) return Math.PI;
  return 2 * Math.acos(1 - sagitta / EARTH_RADIUS_METRES);
}

export function subdivisionCount(
  lengthRadians: number,
  zoom: number,
  latitude: number,
  errorPx: number,
): number {
  return Math.max(1, Math.ceil(lengthRadians / maxSegmentAngleRadians(zoom, latitude, errorPx)));
}

export function greatCircleAngleRadians(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const va = lonLatToSphere(a[0], a[1]);
  const vb = lonLatToSphere(b[0], b[1]);
  const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

export function subdivideRhumb(
  from: readonly [number, number],
  to: readonly [number, number],
  count: number,
): readonly (readonly [number, number])[] {
  const fromY = lonLatToMercatorPixel(from[0], from[1], 0)[1];
  const toY = lonLatToMercatorPixel(to[0], to[1], 0)[1];
  const points: (readonly [number, number])[] = [];
  for (let step = 0; step <= count; step++) {
    const t = step / count;
    const lon = from[0] + (to[0] - from[0]) * t;
    const lat = mercatorPixelToLonLat(0, fromY + (toY - fromY) * t, 0)[1];
    points.push([lon, lat]);
  }
  return points;
}
