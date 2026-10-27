import {
  BLEND_END_ZOOM,
  BLEND_START_ZOOM,
  EARTH_RADIUS_METRES,
  MAX_MERCATOR_LATITUDE,
  TILE_SIZE_PX,
  VERTICAL_FOV_RADIANS,
  greatCircleAngleRadians,
  lonLatToSphere,
  type Vec3,
} from "./geo-math.js";

const DEGREES = Math.PI / 180;

export type LonLat = readonly [number, number];

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface EdgeIndicator {
  readonly x: number;
  readonly y: number;
  readonly angleDegrees: number;
}

export function horizonAngleRadians(altitudeMetres: number): number {
  return Math.acos(EARTH_RADIUS_METRES / (EARTH_RADIUS_METRES + Math.max(0, altitudeMetres)));
}

export function isBeyondHorizon(
  centre: LonLat,
  point: LonLat,
  altitudeMetres: number,
  marginRadians = 0,
): boolean {
  return (
    greatCircleAngleRadians(centre, point) > horizonAngleRadians(altitudeMetres) + marginRadians
  );
}

export function initialBearingDegrees(from: LonLat, to: LonLat): number {
  const lat1 = from[1] * DEGREES;
  const lat2 = to[1] * DEGREES;
  const dLon = (to[0] - from[0]) * DEGREES;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (((Math.atan2(y, x) / DEGREES) % 360) + 360) % 360;
}

export function edgeIndicator(
  bearingDegrees: number,
  mapBearingDegrees: number,
  viewport: Viewport,
  margin: number,
): EdgeIndicator {
  const screenAngle = (bearingDegrees - mapBearingDegrees) * DEGREES;
  const dx = Math.sin(screenAngle);
  const dy = -Math.cos(screenAngle);
  const halfWidth = viewport.width / 2 - margin;
  const halfHeight = viewport.height / 2 - margin;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return {
    x: viewport.width / 2 + dx * scale,
    y: viewport.height / 2 + dy * scale,
    angleDegrees: (((screenAngle / DEGREES) % 360) + 360) % 360,
  };
}

export interface GlobeCamera {
  readonly centre: LonLat;
  readonly zoom: number;
  readonly pitchDegrees: number;
  readonly bearingDegrees: number;
  readonly viewportHeightPx: number;
  readonly fovRadians?: number;
}

export type HorizonClass = "front" | "horizon" | "back";
export type ProjectionMode = "globe" | "transition" | "planar";

export const HORIZON_TOLERANCE_RADIANS = (0.05 * Math.PI) / 180;

export function projectionMode(zoom: number): ProjectionMode {
  if (zoom <= BLEND_START_ZOOM) return "globe";
  return zoom >= BLEND_END_ZOOM ? "planar" : "transition";
}

export function cameraDistanceInSphereRadii(camera: GlobeCamera): number {
  const fov = camera.fovRadians ?? VERTICAL_FOV_RADIANS;
  const distancePx = camera.viewportHeightPx / (2 * Math.tan(fov / 2));
  const latitude = Math.min(Math.abs(camera.centre[1]), MAX_MERCATOR_LATITUDE);
  const globeRadiusPx =
    (TILE_SIZE_PX * 2 ** camera.zoom) / (2 * Math.PI) / Math.cos((latitude * Math.PI) / 180);
  return distancePx / globeRadiusPx;
}

export function cameraPositionInSphereRadii(camera: GlobeCamera): Vec3 {
  const lon = (camera.centre[0] * Math.PI) / 180;
  const lat = (camera.centre[1] * Math.PI) / 180;
  const pitch = (camera.pitchDegrees * Math.PI) / 180;
  const bearing = (camera.bearingDegrees * Math.PI) / 180;
  const up = lonLatToSphere(camera.centre[0], camera.centre[1]);
  const east: Vec3 = [Math.cos(lon), 0, -Math.sin(lon)];
  const north: Vec3 = [
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
    -Math.sin(lat) * Math.cos(lon),
  ];
  const distance = cameraDistanceInSphereRadii(camera);
  const lift = 1 + distance * Math.cos(pitch);
  const back = distance * Math.sin(pitch);
  const heading: Vec3 = [
    Math.sin(bearing) * east[0] + Math.cos(bearing) * north[0],
    Math.sin(bearing) * east[1] + Math.cos(bearing) * north[1],
    Math.sin(bearing) * east[2] + Math.cos(bearing) * north[2],
  ];
  return [
    up[0] * lift - heading[0] * back,
    up[1] * lift - heading[1] * back,
    up[2] * lift - heading[2] * back,
  ];
}

export function horizonMarginRadians(camera: GlobeCamera, point: LonLat): number {
  const cam = cameraPositionInSphereRadii(camera);
  const length = Math.hypot(cam[0], cam[1], cam[2]);
  const p = lonLatToSphere(point[0], point[1]);
  const cosine = (p[0] * cam[0] + p[1] * cam[1] + p[2] * cam[2]) / length;
  const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
  return angle - Math.acos(1 / length);
}

export function classifyHorizon(
  camera: GlobeCamera,
  point: LonLat,
  toleranceRadians = HORIZON_TOLERANCE_RADIANS,
): HorizonClass {
  const margin = horizonMarginRadians(camera, point);
  if (margin > toleranceRadians) return "back";
  return margin < -toleranceRadians ? "front" : "horizon";
}
