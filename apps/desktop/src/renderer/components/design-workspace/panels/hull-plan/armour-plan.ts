import type { ArmourRegionId } from "@bluewave/ship-design";
import { PLAN_MID, type PlanFrame } from "./geometry.js";
import { type Point, polygonPoints } from "./path.js";

/**
 * Armour as it sits on the hull from above: the belt a strip along each side, the citadel and the decks the inner
 * hull between them. SCHEMATIC, like the layers that use it: the lengths are real, the station is a convention.
 * Pure geometry, no SVG components.
 */

/** The belt's depth in from the hull side and the deck edge, as fractions of the half-beam at each station. */
export const BELT_OUTER = 1;
export const BELT_INNER = 0.8;

const STEP = 25;

/** Stations from `from` to `to` (permille): both ends exactly, a point every `STEP` between. */
function stations(from: number, to: number): number[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const mid: number[] = [];
  for (let s = Math.ceil((lo + 1) / STEP) * STEP; s < hi; s += STEP) mid.push(s);
  return [lo, ...mid, hi];
}

/** One side's edge at `scale` of the half-beam, bow to stern; `side` -1 is starboard (up in the drawing). */
function edge(frame: PlanFrame, from: number, to: number, scale: number, side: 1 | -1): Point[] {
  return stations(from, to).map((s) => ({
    x: frame.x(s),
    y: PLAN_MID + side * frame.half(s / 1000) * scale,
  }));
}

/** A closed path hugging both sides of the hull between two stations, from `outer` in to `inner` (fractions of beam). */
export function stripPath(
  frame: PlanFrame,
  from: number,
  to: number,
  outer: number,
  inner: number,
): string {
  return ([-1, 1] as const)
    .map(
      (side) =>
        `M${polygonPoints([
          ...edge(frame, from, to, outer, side),
          ...edge(frame, from, to, inner, side).reverse(),
        ])}Z`,
    )
    .join(" ");
}

/** A closed path over the hull between two stations, out to `scale` of the half-beam on both sides. */
export function regionPath(frame: PlanFrame, from: number, to: number, scale: number): string {
  return `M${polygonPoints([
    ...edge(frame, from, to, scale, -1),
    ...edge(frame, from, to, scale, 1).reverse(),
  ])}Z`;
}

export type ArmourShape = "strip" | "deck" | "inner";

/** How a region is drawn when highlighted: belts hug the sides, decks cover the inner hull, the rest mark it. */
export function armourShape(region: ArmourRegionId): ArmourShape {
  switch (region) {
    case "BELT_MAIN":
    case "BELT_UPPER":
    case "BELT_ENDS":
    case "TORPEDO_BELT":
      return "strip";
    case "DECK_MAIN":
    case "DECK_SLOPE":
    case "DECK_EXTENDED":
      return "deck";
    default:
      return "inner";
  }
}
