import type { FlatPolygon } from "../../lib/simplify-geometry.js";
import { CHART } from "./chart-theme.js";
import { MapLegend } from "./MapLegend.js";
import { MapMinimap } from "./MapMinimap.js";
import { MapScaleBar } from "./MapScaleBar.js";
import type { MapPrototypeState } from "./map-state.js";
import type { MapPalette } from "./map-palette.js";
import type { Projection } from "./projection.js";
import type { MapCamera } from "./useMapCamera.js";

const ORDER_NOTES = [
  "Foreign fleet positions are not known: intelligence is not modelled yet.",
  "Invasion range is not modelled yet.",
];

export interface MapReadoutDockProps {
  readonly camera: MapCamera;
  readonly projection: Projection;
  readonly state: MapPrototypeState;
  readonly palette: MapPalette;
  readonly minimapPolygons: readonly FlatPolygon[] | null;
  readonly hasOrders: boolean;
}

export function MapReadoutDock({
  camera,
  projection,
  state,
  palette,
  minimapPolygons,
  hasOrders,
}: MapReadoutDockProps) {
  return (
    <div
      data-map-obstacle
      className="absolute bottom-[calc(var(--chrome-bottom,0px)+0.75rem)] right-3 flex flex-col items-end gap-2"
    >
      {minimapPolygons !== null && (
        <MapMinimap
          camera={camera}
          projection={projection}
          centre={state.centre}
          polygons={minimapPolygons}
          land={palette.minimapLand}
          ocean={palette.minimapOcean}
          ink={palette.minimapInk}
          borderColor={palette.minimapBorder}
        />
      )}
      <div
        className="pointer-events-none rounded-md border px-2.5 py-1.5 backdrop-blur"
        style={{
          background: "oklch(0.16 0.025 245 / 0.85)",
          borderColor: "oklch(0.4 0.02 245)",
          color: CHART.ink,
        }}
      >
        <MapLegend
          showPossessions={state.layers.possessions}
          showFleets={state.layers.fleets}
          notes={hasOrders ? ORDER_NOTES : []}
        />
        <MapScaleBar camera={camera} worldWidth={projection.width} />
      </div>
    </div>
  );
}
