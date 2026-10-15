/**
 * Per-variant chrome layout. The chart draws the same world in three shells:
 * the full F1 sheet, the embedded Overview panel, and the full-bleed command
 * home. Every difference between them — framed or not, docks or floating
 * panels, which readouts collapse when idle — is data here rather than
 * conditionals scattered through the JSX. A new shell is a new entry, not an
 * edit to `WorldMapChart`.
 */

import { cn } from "../../lib/utils.js";

export type MapVariant = "full" | "panel" | "command";

export interface MapVariantLayout {
  /** Classes appended after the shared root classes (empty for the full-bleed shell). */
  readonly root: string;
  /** The "Layers & areas" disclosure button, or null when controls are always open. */
  readonly layersButton: string | null;
  readonly controlsPanel: string;
  /** Idle controls are hidden behind the disclosure until opened. */
  readonly controlsHideWhenClosed: boolean;
  /** The shell stacks panels into pointer-transparent left/right docks. */
  readonly docked: boolean;
  readonly leftDock: string;
  readonly rightDock: string;
  /** The area list is nested inline (full/panel) rather than a collapsible dock panel. */
  readonly inlineAreas: boolean;
  readonly inspector: string;
  readonly inspectorHideWhenEmpty: boolean;
  readonly routeReadout: string;
  readonly routeHideWhenEmpty: boolean;
}

const CONTROLS_PANEL =
  "flex flex-col gap-2 overflow-y-auto rounded-lg border p-2.5 text-xs shadow-lg backdrop-blur";
const INSPECTOR =
  "rounded-lg border p-3 text-xs shadow-lg backdrop-blur absolute right-3 top-3 w-72";
const ROUTE_READOUT =
  "absolute bottom-[calc(var(--chrome-bottom,0px)+0.75rem)] left-3 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur";

export const MAP_VARIANT_LAYOUT: Readonly<Record<MapVariant, MapVariantLayout>> = {
  full: {
    root: "rounded-lg border shadow-sm",
    layersButton: null,
    controlsPanel: cn(CONTROLS_PANEL, "absolute left-3 top-3 max-h-[calc(100%-7.5rem)]"),
    controlsHideWhenClosed: false,
    docked: false,
    leftDock: "contents",
    rightDock: "contents",
    inlineAreas: true,
    inspector: INSPECTOR,
    inspectorHideWhenEmpty: false,
    routeReadout: ROUTE_READOUT,
    routeHideWhenEmpty: false,
  },
  panel: {
    root: "rounded-lg border shadow-sm",
    layersButton: "bg-background/80 backdrop-blur absolute left-3 top-3 z-10",
    controlsPanel: cn(CONTROLS_PANEL, "absolute left-3 top-14 max-h-[calc(100%-8rem)]"),
    controlsHideWhenClosed: true,
    docked: false,
    leftDock: "contents",
    rightDock: "contents",
    inlineAreas: true,
    inspector: INSPECTOR,
    inspectorHideWhenEmpty: true,
    routeReadout: ROUTE_READOUT,
    routeHideWhenEmpty: true,
  },
  command: {
    root: "",
    layersButton: "bg-background/80 backdrop-blur pointer-events-auto self-start",
    controlsPanel: cn(CONTROLS_PANEL, "pointer-events-auto"),
    controlsHideWhenClosed: true,
    docked: true,
    leftDock:
      "pointer-events-none absolute bottom-[calc(var(--chrome-bottom,0px)+0.75rem)] left-3 top-[calc(var(--chrome-top,0px)+0.75rem)] z-10 flex w-72 flex-col gap-2 overflow-y-auto",
    rightDock:
      "pointer-events-none absolute bottom-[calc(var(--chrome-bottom,0px)+0.75rem)] right-3 top-[calc(var(--chrome-top,0px)+0.75rem)] z-10 flex w-72 flex-col items-stretch gap-2 overflow-y-auto",
    inlineAreas: false,
    inspector: cn("rounded-lg border p-3 text-xs shadow-lg backdrop-blur", "pointer-events-auto"),
    inspectorHideWhenEmpty: true,
    routeReadout: ROUTE_READOUT,
    routeHideWhenEmpty: true,
  },
};
