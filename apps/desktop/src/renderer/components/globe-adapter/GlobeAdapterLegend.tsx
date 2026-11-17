import type { ReactNode } from "react";

import { MAP_VARIANT_LAYOUT, type MapVariant } from "../world-map/map-variant-layout.js";
import { MapLegend } from "../world-map/MapLegend.js";
import { RouteReadout } from "../world-map/RouteReadout.js";
import type { MapPrototypeState, RouteReading } from "../world-map/map-state.js";
import type { GlobeViewport } from "./adapter-layer-state.js";
import { GlobeScaleBar } from "./GlobeAdapterWidgets.js";

export interface GlobeAdapterLegendProps {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly viewport: GlobeViewport;
  readonly variant: MapVariant;
  readonly children?: ReactNode;
}

export function GlobeAdapterLegend({
  state,
  route,
  viewport,
  variant,
  children,
}: GlobeAdapterLegendProps) {
  const layout = MAP_VARIANT_LAYOUT[variant];
  return (
    <>
      <div className="pointer-events-auto absolute bottom-[calc(0.75rem+var(--chrome-bottom,0px)+var(--chrome-slip,0px))] right-[calc(0.75rem+var(--chrome-right,0px))] z-10 flex flex-col items-end gap-2">
        {children}
        <div className="rounded border border-white/25 bg-black/75 px-2.5 py-1.5 text-white">
          <MapLegend showPossessions={state.layers.possessions} showFleets={state.layers.fleets} />
          <GlobeScaleBar zoom={viewport.zoom} />
          <p className="mt-1 text-xs text-white/60">
            Land climate: Köppen-Geiger V3, Beck et al. (2023), CC BY 4.0
          </p>
        </div>
      </div>

      <RouteReadout
        className={`${
          variant === "command"
            ? "absolute bottom-[calc(0.75rem+var(--chrome-bottom,0px)+var(--chrome-slip,0px))] left-1/2 -translate-x-1/2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur"
            : layout.routeReadout
        } pointer-events-auto z-10`}
        route={route}
      />
    </>
  );
}
