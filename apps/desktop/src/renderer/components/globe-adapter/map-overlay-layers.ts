import type { LayerSpecification } from "maplibre-gl";

import {
  type adapterLayerVisibility,
  borderColorExpression,
  fleetGlyphFilter,
  markerFilter,
  overlayClassFilter,
} from "./adapter-layer-state.js";
import { FLEET_GLYPH_ID } from "./fleet-glyph.js";

export function overlayLayers(
  visibility: ReturnType<typeof adapterLayerVisibility>,
): LayerSpecification[] {
  return [
    {
      id: "adapter-borders-fill",
      type: "fill",
      source: "adapter-borders",
      layout: { visibility: visibility.borders ? "visible" : "none" },
      paint: {
        "fill-color": borderColorExpression() as never,
        "fill-opacity": 0.04,
      },
    },
    {
      id: "adapter-borders-line",
      type: "line",
      source: "adapter-border-lines",
      layout: { visibility: visibility.borders ? "visible" : "none" },
      paint: {
        "line-color": borderColorExpression() as never,
        "line-width": 1.2,
        "line-opacity": 0.85,
      },
    },
    {
      id: "adapter-graticule",
      type: "line",
      source: "adapter-graticule",
      layout: { visibility: visibility.graticule ? "visible" : "none" },
      paint: { "line-color": "#7ea6b8", "line-width": 0.6, "line-opacity": 0.35 },
    },
    {
      id: "adapter-lanes",
      type: "line",
      source: "adapter-routes",
      filter: overlayClassFilter("lane") as never,
      layout: {
        visibility: visibility.lanes ? "visible" : "none",
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#06425c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.1, 5, 2],
        "line-opacity": 0.75,
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "adapter-routes",
      type: "line",
      source: "adapter-routes",
      filter: overlayClassFilter("route") as never,
      layout: {
        visibility: visibility.routes ? "visible" : "none",
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": [
          "match",
          ["get", "routeClass"],
          "preview",
          "#ffd24a",
          "planned",
          "#ff8c1a",
          "#3aa0e0",
        ],
        "line-width": ["match", ["get", "routeClass"], "static", 1, 2.5],
        "line-opacity": ["case", ["boolean", ["feature-state", "hidden"], false], 0, 1],
      },
    },
  ];
}

export function markerLayers(
  visibility: ReturnType<typeof adapterLayerVisibility>,
): LayerSpecification[] {
  return [
    {
      id: "adapter-markers",
      type: "circle",
      source: "adapter-markers",
      filter: markerFilter(visibility) as never,
      paint: {
        "circle-radius": ["match", ["get", "markerClass"], "fleet", 8, 5],
        "circle-color": [
          "case",
          ["==", ["get", "markerClass"], "alert"],
          "#ff5c5c",
          ["==", ["get", "color"], ""],
          ["match", ["get", "markerClass"], "fleet", "#0b3a5c", "#ffd24a"],
          ["to-color", ["get", "color"]],
        ],
        "circle-stroke-color": "#001018",
        "circle-stroke-width": 1.5,
        "circle-opacity": [
          "case",
          ["boolean", ["feature-state", "hidden"], false],
          0,
          ["==", ["get", "markerClass"], "fleet"],
          0,
          1,
        ],
        "circle-stroke-opacity": [
          "case",
          ["boolean", ["feature-state", "hidden"], false],
          0,
          ["==", ["get", "markerClass"], "fleet"],
          0,
          1,
        ],
      },
    },
    {
      id: "adapter-fleet-glyphs",
      type: "symbol",
      source: "adapter-markers",
      filter: fleetGlyphFilter(visibility) as never,
      layout: {
        "icon-image": FLEET_GLYPH_ID,
        "icon-size": 0.8,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": [
          "case",
          ["==", ["get", "color"], ""],
          "#0b3a5c",
          ["to-color", ["get", "color"]],
        ],
        "icon-halo-color": "#ffffff",
        "icon-halo-width": 2,
        "icon-opacity": ["case", ["boolean", ["feature-state", "hidden"], false], 0, 1],
      },
    },
    {
      id: "adapter-marker-labels",
      type: "symbol",
      source: "adapter-markers",
      filter: markerFilter(visibility) as never,
      minzoom: 4,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Inter Regular"],
        "text-size": 11,
        "text-offset": [0, 1.1],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "#001018", "text-halo-width": 1.2 },
    },
    {
      id: "adapter-selected-ring",
      type: "circle",
      source: "adapter-markers",
      filter: ["==", ["get", "areaId"], ""],
      paint: {
        "circle-radius": 12,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
    {
      id: "adapter-selected-fleet-ring",
      type: "circle",
      source: "adapter-markers",
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-radius": 11,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#ffd24a",
        "circle-stroke-width": 2.5,
      },
    },
  ];
}
