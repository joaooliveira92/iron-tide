import type { MountSide, ZoneId } from "@bluewave/ship-design";
import { PLAN_MID, PLAN_PAD, PLAN_W, type PlanFrame } from "./geometry.js";

/**
 * Where a plan point lands on the hull: station, zone and side. Pure coordinate-to-domain mapping shared by the
 * pointer editing, the toolbar and auto-placement. Coordinates are plan SVG user units (see `geometry.ts`): bow
 * at the left, starboard above the centreline.
 */

/** Stations snap to this grid (permille of waterline length) so clicks land on tidy values. */
export const STATION_SNAP_PERMILLE = 10;
/** A click within this fraction of the half-beam of the centreline places a centreline mount. */
export const CENTRE_BAND = 0.25;

export interface ZoneSpan {
  readonly id: string;
  readonly startPermille: number;
  readonly endPermille: number;
}

/** Inverse of `stationX`: the station (permille, snapped, 0..1000) under a plan x coordinate. */
export function stationAtX(svgX: number): number {
  const span = PLAN_W - 2 * PLAN_PAD;
  const raw = ((svgX - PLAN_PAD) / span) * 1000;
  const snapped = Math.round(raw / STATION_SNAP_PERMILLE) * STATION_SNAP_PERMILLE;
  return Math.min(1000, Math.max(0, snapped));
}

/** The zone a station lies in; the overlapping MISSION zone is never a placement target. Null if none. */
export function zoneAtStation(zones: readonly ZoneSpan[], station: number): ZoneId | null {
  const hit = zones.find(
    (z) =>
      z.id !== "MISSION" &&
      station >= z.startPermille &&
      (station < z.endPermille || (station === 1000 && z.endPermille === 1000)),
  );
  return hit ? (hit.id as ZoneId) : null;
}

/** Side of a click: near the centreline is CENTRE, above it starboard, below it port. */
export function sideAtY(frame: Pick<PlanFrame, "maxHalf">, svgY: number): MountSide {
  const offset = svgY - PLAN_MID;
  if (Math.abs(offset) <= frame.maxHalf * CENTRE_BAND) return "CENTRE";
  return offset < 0 ? "STBD" : "PORT";
}

export interface PlanTarget {
  readonly stationPermille: number;
  readonly zoneId: ZoneId | null;
  readonly side: MountSide;
}

export function planTarget(
  frame: Pick<PlanFrame, "maxHalf">,
  zones: readonly ZoneSpan[],
  svgX: number,
  svgY: number,
): PlanTarget {
  const stationPermille = stationAtX(svgX);
  return {
    stationPermille,
    zoneId: zoneAtStation(zones, stationPermille),
    side: sideAtY(frame, svgY),
  };
}
