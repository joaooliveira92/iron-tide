import type { DesignDraft } from "@bluewave/ship-design";
import { fittingPoint, PLAN_H, PLAN_W, type PlanFrame } from "./geometry.js";

export const GRAB_RADIUS = 10;

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
