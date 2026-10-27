import { EARTH_RADIUS_METRES, greatCircleAngleRadians } from "./geo-math.js";

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
