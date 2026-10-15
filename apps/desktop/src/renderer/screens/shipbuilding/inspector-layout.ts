import type { UiStateInspectorLayout } from "../../../shared/campaign-command-contract.js";
import {
  INSPECTOR_MAX_WIDTH_PX,
  INSPECTOR_MIN_WIDTH_PX,
} from "../../../shared/campaign-command-contract.js";

/**
 * The shipbuilding inspector's layout vocabulary: the width bounds and the tolerant decode of the
 * persisted choice. Presentation only — the width never reaches the design or the simulation, and is
 * remembered per campaign through the renderer-owned `ui-state.json` sidecar (ADR-0038).
 */

export type InspectorLayout = UiStateInspectorLayout;

/** Narrowest the inspector may get: its forms and tab strip stay usable. */
export const INSPECTOR_MIN_PX = INSPECTOR_MIN_WIDTH_PX;
/** Widest the inspector may get before it starts crowding out the ship. */
export const INSPECTOR_MAX_PX = INSPECTOR_MAX_WIDTH_PX;
/** The width the inspector opens at, inside the 400–480 recommendation band. */
export const INSPECTOR_DEFAULT_PX = 440;
/** The restore strip the inspector folds down to. */
export const INSPECTOR_COLLAPSED_PX = 36;
/** How far an arrow key or a drag nudge moves the divider, in pixels. */
export const INSPECTOR_RESIZE_STEP_PX = 16;

export const DEFAULT_INSPECTOR_LAYOUT: InspectorLayout = {
  widthPx: INSPECTOR_DEFAULT_PX,
  collapsed: false,
};

/** Clamps a proposed width to the supported range; a non-finite width falls back to the default. */
export function clampInspectorWidth(px: number): number {
  if (!Number.isFinite(px)) return INSPECTOR_DEFAULT_PX;
  return Math.round(Math.min(INSPECTOR_MAX_PX, Math.max(INSPECTOR_MIN_PX, px)));
}

/** The stored layout, clamped and field-by-field; anything missing or out of shape takes the default. */
export function normalizeInspectorLayout(raw: unknown): InspectorLayout {
  if (typeof raw !== "object" || raw === null) return DEFAULT_INSPECTOR_LAYOUT;
  const r = raw as Record<string, unknown>;
  const width = r["widthPx"];
  return {
    widthPx: typeof width === "number" ? clampInspectorWidth(width) : INSPECTOR_DEFAULT_PX,
    collapsed: r["collapsed"] === true,
  };
}
