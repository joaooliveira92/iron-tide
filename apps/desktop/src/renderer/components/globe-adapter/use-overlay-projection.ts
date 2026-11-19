import { type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useExternalSync } from "../../shell/useExternalSync.js";
import type { GlobeAdapterProps } from "./globe-adapter-types.js";
import { projectOverlay } from "./overlay-projection.js";
import type { OverlayStore } from "./overlay-store.js";

export interface OverlayProjectionInput {
  readonly mapRef: MutableRefObject<MapLibreMap | null>;
  readonly storeRef: MutableRefObject<OverlayStore | null>;
  readonly ready: boolean;
  readonly overlay: GlobeAdapterProps["overlay"];
  readonly state: GlobeAdapterProps["state"];
  readonly route: GlobeAdapterProps["route"];
  readonly orders: GlobeAdapterProps["orders"];
}

export function useOverlayProjection({
  mapRef,
  storeRef,
  ready,
  overlay,
  state,
  route,
  orders,
}: OverlayProjectionInput): void {
  useExternalSync(() => {
    const map = mapRef.current;
    const store = storeRef.current;
    if (map === null || store === null || !ready) return;
    const projected = projectOverlay({
      overlay,
      state,
      route,
      orders,
      selectedAreaId: state.selected,
    });
    store.replace(projected.features);
  }, [mapRef, orders, overlay, ready, route, state, storeRef]);
}
