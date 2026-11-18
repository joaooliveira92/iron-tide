import { integerRoot } from "@bluewave/deterministic";
import { DIVISION_ORDER_MAX_KNOTS, WAYPOINT_MAX_METRES } from "../orders/constants.js";
import { DIRECTION_TABLE } from "../movement/directionTable.js";
import type { DivisionAiContact, Point } from "./contracts.js";

const TRIG_SCALE = 10_000;
const METRES_PER_NAUTICAL_MILE = 1_852;
const MINUTES_PER_HOUR = 60;

export function foldDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function relativeDegrees(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

export function directionOf(headingDeg: number): readonly [number, number] {
  return DIRECTION_TABLE[foldDegrees(headingDeg)]!;
}

export function roundedDivide(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function ceilDivide(numerator: number, denominator: number): number {
  return -Math.floor(-numerator / denominator);
}

export function clampInt(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

export function isqrt(value: number): number {
  return Number(integerRoot(BigInt(value), 2));
}

export function distanceMetres(a: Point, b: Point): number {
  const dx = a.xMetres - b.xMetres;
  const dy = a.yMetres - b.yMetres;
  return isqrt(dx * dx + dy * dy);
}

export function clampPoint(point: Point): Point {
  return {
    xMetres: clampInt(point.xMetres, -WAYPOINT_MAX_METRES, WAYPOINT_MAX_METRES),
    yMetres: clampInt(point.yMetres, -WAYPOINT_MAX_METRES, WAYPOINT_MAX_METRES),
  };
}

export function offsetPoint(origin: Point, headingDeg: number, metres: number): Point {
  const [cos, sin] = directionOf(headingDeg);
  return {
    xMetres: origin.xMetres + roundedDivide(metres * cos, TRIG_SCALE),
    yMetres: origin.yMetres + roundedDivide(metres * sin, TRIG_SCALE),
  };
}

export function stationPoint(
  origin: Point,
  headingDeg: number,
  aheadMetres: number,
  portMetres: number,
): Point {
  return offsetPoint(offsetPoint(origin, headingDeg, aheadMetres), headingDeg + 90, portMetres);
}

export function bearingDegrees(from: Point, to: Point): number {
  const dx = to.xMetres - from.xMetres;
  const dy = to.yMetres - from.yMetres;
  let best = 0;
  let bestDot = Number.NEGATIVE_INFINITY;
  for (let heading = 0; heading < 360; heading++) {
    const [cos, sin] = DIRECTION_TABLE[heading]!;
    const dot = dx * cos + dy * sin;
    if (dot > bestDot) {
      bestDot = dot;
      best = heading;
    }
  }
  return best;
}

export function metresPerMinute(knots: number): number {
  return roundedDivide(knots * METRES_PER_NAUTICAL_MILE, MINUTES_PER_HOUR);
}

export function clampKnots(knots: number, maxKnots: number): number {
  const ceiling = Math.max(1, Math.min(maxKnots, DIVISION_ORDER_MAX_KNOTS));
  return clampInt(knots, 1, ceiling);
}

export function interceptPoint(own: Point, ownKnots: number, target: DivisionAiContact): Point {
  const speed = Math.max(metresPerMinute(ownKnots), 1);
  let aim = target.position;
  for (let step = 0; step < 3; step++) {
    const minutes = ceilDivide(distanceMetres(own, aim), speed);
    aim = offsetPoint(
      target.position,
      target.headingDeg,
      metresPerMinute(target.speedKnots) * minutes,
    );
  }
  return clampPoint(aim);
}

export function trackPointBehind(
  track: readonly Point[],
  head: Point,
  metresBehind: number,
): Point {
  const points: readonly Point[] = [...track, head];
  let remaining = metresBehind;
  for (let index = points.length - 1; index > 0; index--) {
    const a = points[index]!;
    const b = points[index - 1]!;
    const segment = distanceMetres(a, b);
    if (segment >= remaining) {
      const scale = Math.max(segment, 1);
      return {
        xMetres: a.xMetres + roundedDivide((b.xMetres - a.xMetres) * remaining, scale),
        yMetres: a.yMetres + roundedDivide((b.yMetres - a.yMetres) * remaining, scale),
      };
    }
    remaining -= segment;
  }
  return points[0]!;
}

export function nearestContact(
  from: Point,
  contacts: readonly DivisionAiContact[],
  kind?: DivisionAiContact["kind"],
): DivisionAiContact | null {
  let best: DivisionAiContact | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const contact of contacts) {
    if (kind !== undefined && contact.kind !== kind) continue;
    const distance = distanceMetres(from, contact.position);
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && contact.contactId < best.contactId)
    ) {
      bestDistance = distance;
      best = contact;
    }
  }
  return best;
}
