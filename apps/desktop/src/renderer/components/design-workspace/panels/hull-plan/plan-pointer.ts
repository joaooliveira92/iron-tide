import type { DesignDraft } from "@bluewave/ship-design";
import { fittingPoint, PLAN_H, PLAN_W, type PlanFrame } from "./geometry.js";

/**
 * Screen-to-plan mapping for the pointer: turning a client point into plan units and finding the fitting under
 * it. Pure geometry, no tool state; the drawing's click and drag layers call these.
 */

/** How close (plan units) a pointer must be to a fitting's dot to grab it. */
export const GRAB_RADIUS = 10;

/** A pointer position in plan SVG units from the drawing's on-screen rectangle; null when the rectangle has no size. */
export function clientToPlan(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  return {
    x: ((clientX - rect.left) * PLAN_W) / rect.width,
    y: ((clientY - rect.top) * PLAN_H) / rect.height,
  };
}

/**
 * The fitting under a plan point: the nearest dot within `GRAB_RADIUS`, using the same positions the drawing uses (centreline
 * dots keep their cosmetic nudge). Null when none is close enough. Ties go to the earlier placement, so it is deterministic.
 */
export function fittingAt(
  frame: PlanFrame,
  draft: Pick<DesignDraft, "placements">,
  svgX: number,
  svgY: number,
): string | null {
  let best: string | null = null;
  let bestD2 = GRAB_RADIUS ** 2;
  for (const [index, p] of draft.placements.entries()) {
    const pt = fittingPoint(frame, p.stationPermille, p.side, index);
    const d2 = (pt.x - svgX) ** 2 + (pt.y - svgY) ** 2;
    if (d2 < bestD2 || (best === null && d2 === bestD2)) {
      best = p.instanceId;
      bestD2 = d2;
    }
  }
  return best;
}
