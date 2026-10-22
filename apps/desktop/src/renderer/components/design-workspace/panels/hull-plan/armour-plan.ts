import type { ArmourRegionId } from "@bluewave/ship-design";
import { PLAN_MID, type PlanFrame } from "./geometry.js";
import { type Point, polygonPoints } from "./path.js";

export const BELT_OUTER = 1;
export const BELT_INNER = 0.8;

const STEP = 25;

function stations(from: number, to: number): number[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const mid: number[] = [];
  for (let s = Math.ceil((lo + 1) / STEP) * STEP; s < hi; s += STEP) mid.push(s);
  return [lo, ...mid, hi];
}

function edge(frame: PlanFrame, from: number, to: number, scale: number, side: 1 | -1): Point[] {
  return stations(from, to).map((s) => ({
    x: frame.x(s),
    y: PLAN_MID + side * frame.half(s / 1000) * scale,
  }));
}

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

export function regionPath(frame: PlanFrame, from: number, to: number, scale: number): string {
  return `M${polygonPoints([
    ...edge(frame, from, to, scale, -1),
    ...edge(frame, from, to, scale, 1).reverse(),
  ])}Z`;
}

export type ArmourShape = "strip" | "deck" | "inner";

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
