import { cn } from "../../lib/utils.js";

export type MapVariant = "full" | "panel" | "command";

export interface MapVariantLayout {
  readonly root: string;
  readonly layersButton: string | null;
  readonly controlsPanel: string;
  readonly controlsHideWhenClosed: boolean;
  readonly docked: boolean;
  readonly leftDock: string;
  readonly rightDock: string;
  readonly inlineAreas: boolean;
  readonly inspector: string;
  readonly inspectorHideWhenEmpty: boolean;
  readonly routeReadout: string;
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
      "pointer-events-none absolute bottom-[calc(var(--chrome-bottom,0px)+0.75rem)] right-[calc(0.75rem+var(--chrome-right,0px))] top-[calc(var(--chrome-top,0px)+0.75rem)] z-10 flex w-72 flex-col items-stretch gap-2 overflow-y-auto",
    inlineAreas: false,
    inspector: cn("rounded-lg border p-3 text-xs shadow-lg backdrop-blur", "pointer-events-auto"),
    inspectorHideWhenEmpty: true,
    routeReadout: ROUTE_READOUT,
  },
};
