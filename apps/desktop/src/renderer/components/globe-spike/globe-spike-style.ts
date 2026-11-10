import type { LayerSpecification, SourceSpecification, StyleSpecification } from "maplibre-gl";

import { tileUrlTemplate } from "./baked-tiles.js";
import {
  markerCollection,
  routeCollection,
  type GeoFeatureCollection,
} from "./globe-spike-scene.js";
import { areaCollection, areaLabelCollection } from "./spike-areas.js";
import type { LandPlan } from "./use-land-plan.js";

export const EMPTY: GeoFeatureCollection = { type: "FeatureCollection", features: [] };

function baseDirectory(): string {
  const href = document.baseURI;
  return href.slice(0, href.lastIndexOf("/") + 1);
}

export type ReadyPlan = Exclude<
  LandPlan,
  { readonly kind: "loading" } | { readonly kind: "failed" }
>;

function landSource(plan: ReadyPlan): SourceSpecification {
  if (plan.kind === "runtime") {
    return { type: "geojson", data: plan.coast as never, maxzoom: 10, tolerance: 0.2 };
  }
  const { manifest } = plan.tiles;
  return {
    type: "vector",
    tiles: [tileUrlTemplate()],
    minzoom: manifest.zoom.tileMin,
    maxzoom: manifest.zoom.tileMax,
    bounds: [...manifest.bounds],
    scheme: "xyz",
  };
}

function landLayers(plan: ReadyPlan): LayerSpecification[] {
  const sourceLayer =
    plan.kind === "baked" ? { "source-layer": plan.tiles.manifest.layers.land } : {};
  const layers: LayerSpecification[] = [
    {
      id: "land",
      type: "fill",
      source: "land",
      ...sourceLayer,
      paint: { "fill-color": "#33473b" },
    },
  ];
  if (plan.kind === "baked") {
    layers.push({
      id: "protected-water",
      type: "line",
      source: "land",
      "source-layer": plan.tiles.manifest.layers.protected,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0b2a3f", "line-width": ["get", "width"] },
    });
  }
  return layers;
}

function areaLayerSource(
  plan: ReadyPlan,
  part: "areas" | "areaOutlines",
): { readonly source: string; readonly "source-layer"?: string } {
  return plan.kind === "baked"
    ? { source: "land", "source-layer": plan.tiles.manifest.layers[part] }
    : { source: "areas" };
}

export function buildStyle(plan: ReadyPlan): StyleSpecification {
  return {
    version: 8,
    glyphs: `${baseDirectory()}map-spike/glyphs/{fontstack}/{range}.pbf`,
    projection: { type: "globe" },
    sources: {
      land: landSource(plan),
      ...(plan.kind === "baked"
        ? {}
        : {
            areas: {
              type: "geojson" as const,
              data: areaCollection(true) as never,
              maxzoom: 22,
              tolerance: 0,
            },
            areaLabels: {
              type: "geojson" as const,
              data: areaLabelCollection() as never,
              maxzoom: 22,
              tolerance: 0,
            },
          }),
      markers: { type: "geojson", data: markerCollection() as never, maxzoom: 22, tolerance: 0 },
      routes: { type: "geojson", data: routeCollection() as never, maxzoom: 22, tolerance: 0 },
      probe: { type: "geojson", data: EMPTY as never, maxzoom: 24, tolerance: 0 },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#0b2a3f" } },
      ...landLayers(plan),
      {
        id: "areas-fill",
        type: "fill",
        ...areaLayerSource(plan, "areas"),
        paint: { "fill-color": "#3aa0e0", "fill-opacity": 0.1 },
      },
      {
        id: "areas-line",
        type: "line",
        ...areaLayerSource(plan, "areaOutlines"),
        paint: { "line-color": "#5fc0ff", "line-width": 1 },
      },
      {
        id: "area-labels",
        type: "symbol",
        ...(plan.kind === "baked"
          ? { source: "land", "source-layer": plan.tiles.manifest.layers.areaLabels }
          : { source: "areaLabels" }),
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Inter Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 5, 13, 8, 14],
          "text-max-width": 9,
          "text-padding": 2,
        },
        paint: {
          "text-color": "#d9f2ff",
          "text-halo-color": "#0b2a3f",
          "text-halo-width": 1.5,
        },
      },
      {
        id: "routes",
        type: "line",
        source: "routes",
        paint: { "line-color": "#ff8c1a", "line-width": 2 },
      },
      {
        id: "markers",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 6,
          "circle-color": "#ffd24a",
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 2,
        },
      },
      {
        id: "selected-ring",
        type: "circle",
        source: "markers",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": 11,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      },
      {
        id: "marker-labels",
        type: "symbol",
        source: "markers",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Inter Regular"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#000000", "text-halo-width": 1.5 },
      },
      {
        id: "probe",
        type: "circle",
        source: "probe",
        paint: { "circle-radius": 5, "circle-color": "#ff0000", "circle-opacity": 1 },
      },
    ],
  };
}
