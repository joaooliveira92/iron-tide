import {
  PLOT_CENTER,
  PLOT_HEIGHT,
  PLOT_OUTER_RADIUS,
  PLOT_WIDTH,
  percentAt,
  pointAt,
  type PlotNode,
} from "./diplomacy-plot.js";
import type { DiplomacyRelationRow } from "./diplomacy-view-model.js";

export const BEARING_STEP = 30;
export const TICK_STEP = 10;
export const MAX_HEIGHT_REM = 28;
const LABEL_GAP = 30;

export function linkClass(row: DiplomacyRelationRow): string {
  if (row.atWar) return "stroke-destructive";
  if (row.allied) return "stroke-success";
  if (row.nap) return "stroke-muted-foreground";
  return "stroke-border";
}

export function linkWidth(row: DiplomacyRelationRow): number {
  return row.atWar ? 3 : row.allied ? 2.5 : row.nap ? 1.5 : 1;
}

export function linkDash(row: DiplomacyRelationRow): string | undefined {
  if (row.atWar || row.allied) return undefined;
  return row.nap ? "6 5" : "2 5";
}

export const TICK_DEGREES: readonly number[] = Array.from(
  { length: 360 / TICK_STEP },
  (_, index) => index * TICK_STEP,
);

export const BEARING_DEGREES: readonly number[] = TICK_DEGREES.filter(
  (degrees) => degrees % BEARING_STEP === 0,
);

export interface TickSegment {
  readonly degrees: number;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}

export function tickSegment(degrees: number): TickSegment {
  const major = degrees % BEARING_STEP === 0;
  return {
    degrees,
    from: pointAt(degrees - 90, PLOT_OUTER_RADIUS + 6),
    to: pointAt(degrees - 90, PLOT_OUTER_RADIUS + (major ? 20 : 13)),
  };
}

export function bearingLabelAt(degrees: number): { left: string; top: string } {
  const at = pointAt(degrees - 90, PLOT_OUTER_RADIUS + 34);
  return percentAt(at.x, at.y);
}

export interface ContactLabelPlacement {
  readonly side: "left" | "right";
  readonly shiftClass: string;
  readonly style: { left: string; top: string };
}

export function contactLabelPlacement(node: PlotNode): ContactLabelPlacement {
  const outward = pointAt(node.angle, LABEL_GAP);
  const dx = outward.x - PLOT_CENTER;
  const dy = outward.y - PLOT_CENTER;
  return {
    side: dx > 0 ? "right" : "left",
    shiftClass:
      Math.abs(dx) < 6 ? "-translate-x-1/2" : dx > 0 ? "translate-x-0" : "-translate-x-full",
    style: percentAt(node.x + dx, node.y + dy),
  };
}

export function blockadeMarkerStyle(node: PlotNode): { left: string; top: string } {
  const at = pointAt(node.angle, node.radius * 0.5);
  return percentAt(at.x, at.y);
}

export function plotFrameStyle(): { aspectRatio: string; maxWidth: string } {
  return {
    aspectRatio: `${PLOT_WIDTH} / ${PLOT_HEIGHT}`,
    maxWidth: `${(MAX_HEIGHT_REM * PLOT_WIDTH) / PLOT_HEIGHT}rem`,
  };
}
