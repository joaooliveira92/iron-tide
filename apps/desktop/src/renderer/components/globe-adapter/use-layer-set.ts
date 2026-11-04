import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapPrototypeState } from "../world-map/map-state.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import {
  adapterLayerVisibility,
  fleetGlyphFilter,
  markerFilter,
  ownershipPaintValues,
} from "./adapter-layer-state.js";

export interface LayerSetInput {
  readonly mapRef: RefObject<MapLibreMap | null>;
  readonly ready: boolean;
  readonly variant: MapVariant;
  readonly layers: MapPrototypeState["layers"];
  readonly ownership: ReadonlyMap<string, string | null>;
  readonly selected: string | null;
  readonly selectedAreaRef: MutableRefObject<string | null>;
  readonly hoveredArea: string | null;
  readonly selectedFleet: string | null;
}

export function useLayerSet({
  mapRef,
  ready,
  variant,
  layers,
  ownership,
  selected,
  selectedAreaRef,
  hoveredArea,
  selectedFleet,
}: LayerSetInput): void {
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const visibility = adapterLayerVisibility(layers);
    const set = (id: string, visible: boolean) =>
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    set("area-labels-list", variant !== "command" && visibility.labels);
    set("adapter-borders-fill", visibility.borders);
    set("adapter-borders-line", visibility.borders);
    set("adapter-graticule", visibility.graticule);
    set("adapter-lanes", visibility.lanes);
    set("adapter-routes", visibility.routes);
    map.setFilter("adapter-markers", markerFilter(visibility) as never);
    map.setFilter("adapter-fleet-glyphs", fleetGlyphFilter(visibility) as never);
    map.setFilter("adapter-marker-labels", markerFilter(visibility) as never);
  }, [mapRef, ready, variant, layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const paint = ownershipPaintValues({ ownership }, layers.ownership);
    map.setPaintProperty("areas-fill", "fill-color", paint.color as never);
    map.setPaintProperty("areas-fill", "fill-opacity", paint.opacity);
  }, [mapRef, ownership, ready, layers.ownership]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setFilter("areas-selected", ["==", ["get", "id"], selected ?? "__none__"]);
    map.setFilter("adapter-selected-ring", ["==", ["get", "areaId"], selected ?? "__none__"]);
    selectedAreaRef.current = selected;
  }, [mapRef, ready, selected, selectedAreaRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const filter = ["==", ["get", "id"], hoveredArea ?? "__none__"];
    map.setFilter("areas-hover", filter as never);
    map.setFilter("areas-hover-line", filter as never);
  }, [mapRef, hoveredArea, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setFilter("adapter-selected-fleet-ring", [
      "==",
      ["get", "id"],
      selectedFleet === null ? "" : `fleet:${selectedFleet}`,
    ]);
  }, [mapRef, ready, selectedFleet]);
}
