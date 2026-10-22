import type { UiStateInspectorLayout } from "../../../shared/ui-state-contract.js";
import {
  INSPECTOR_MAX_WIDTH_PX,
  INSPECTOR_MIN_WIDTH_PX,
} from "../../../shared/ui-state-contract.js";

export type InspectorLayout = UiStateInspectorLayout;

export const INSPECTOR_MIN_PX = INSPECTOR_MIN_WIDTH_PX;
export const INSPECTOR_MAX_PX = INSPECTOR_MAX_WIDTH_PX;
export const INSPECTOR_DEFAULT_PX = 440;
export const INSPECTOR_COLLAPSED_PX = 36;
export const INSPECTOR_RESIZE_STEP_PX = 16;

export const DEFAULT_INSPECTOR_LAYOUT: InspectorLayout = {
  widthPx: INSPECTOR_DEFAULT_PX,
  collapsed: false,
};

export function clampInspectorWidth(px: number): number {
  if (!Number.isFinite(px)) return INSPECTOR_DEFAULT_PX;
  return Math.round(Math.min(INSPECTOR_MAX_PX, Math.max(INSPECTOR_MIN_PX, px)));
}

export function normalizeInspectorLayout(raw: unknown): InspectorLayout {
  if (typeof raw !== "object" || raw === null) return DEFAULT_INSPECTOR_LAYOUT;
  const r = raw as Record<string, unknown>;
  const width = r["widthPx"];
  return {
    widthPx: typeof width === "number" ? clampInspectorWidth(width) : INSPECTOR_DEFAULT_PX,
    collapsed: r["collapsed"] === true,
  };
}
