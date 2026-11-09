import type { LayerSpecification } from "maplibre-gl";

import type { useLandPlan } from "../globe-spike/use-land-plan.js";
import type { LayerId } from "../world-map/map-state.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";
import {
  adapterLayerVisibility,
  borderColorExpression,
  fleetGlyphFilter,
  markerFilter,
  overlayClassFilter,
  ownershipPaintValues,
} from "./adapter-layer-state.js";
import { srgbToCanvasHex } from "./display-color.js";
import { FLEET_GLYPH_ID } from "./fleet-glyph.js";

export type BakedLandPlan = Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>;

export type OwnershipOverlay = NonNullable<WorldMapChartProps["overlay"]>["ownership"];

export interface MapLayerInputs {
  readonly ownership: OwnershipOverlay;
  readonly layers: Readonly<Record<LayerId, boolean>>;
  readonly variant: MapVariant;
}

const AREA_LAYER_IDS: ReadonlySet<string> = new Set([
  "areas-fill",
  "areas-hover",
  "areas-selected",
  "areas-hover-line",
  "areas-line",
  "area-labels-list",
]);

const SEA_COLOR = srgbToCanvasHex("#00cce0");
const LAND_COLOR = srgbToCanvasHex("#fcf4f0");
const CLIMATE_ZONE_COLORS: readonly (readonly [number, string])[] = [
  [1, srgbToCanvasHex("#44d8b8")],
  [2, srgbToCanvasHex("#70e0c4")],
  [3, LAND_COLOR],
  [4, srgbToCanvasHex("#f8ece0")],
  [5, srgbToCanvasHex("#94e8d4")],
  [6, srgbToCanvasHex("#b4eee0")],
  [7, srgbToCanvasHex("#f4f8f8")],
];

const DEPTH_COLORS: readonly (readonly [number, string])[] = [
  [200, srgbToCanvasHex("#00bad6")],
  [1000, srgbToCanvasHex("#00a6cc")],
  [4000, srgbToCanvasHex("#0090bd")],
];
const REEF_COLOR = srgbToCanvasHex("#f2fffb");

function depthFillColor(): unknown {
  return ["match", ["get", "depth"], ...DEPTH_COLORS.flat(), SEA_COLOR];
}

function climateFillColor(): unknown {
  return ["match", ["get", "zone"], ...CLIMATE_ZONE_COLORS.flat(), LAND_COLOR];
}

function ownershipPaint(ownership: OwnershipOverlay): LayerSpecification["paint"] {
  const paint = ownershipPaintValues({ ownership }, true);
  return {
    "fill-color": paint.color,
    "fill-opacity": paint.opacity,
  } as LayerSpecification["paint"];
}

function terrainLayers(plan: BakedLandPlan): LayerSpecification[] {
  const { manifest } = plan.tiles;
  return [
    { id: "ocean", type: "background", paint: { "background-color": SEA_COLOR } },
    {
      id: "bathymetry-fill",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.bathymetry,
      layout: { "fill-sort-key": ["get", "depth"] as never },
      paint: { "fill-color": depthFillColor() as never, "fill-antialias": false },
    },
    {
      id: "land",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.land,
      paint: { "fill-color": LAND_COLOR },
    },
    {
      id: "climate-fill",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.climate,
      paint: { "fill-color": climateFillColor() as never, "fill-antialias": false },
    },
    {
      id: "reefs-line",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.reefs,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": REEF_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 8, 1.4],
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.85,
      },
    },
    {
      id: "protected-water",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.protected,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": SEA_COLOR, "line-width": ["get", "width"] },
    },
  ];
}

function areaLayers(
  plan: BakedLandPlan,
  ownership: OwnershipOverlay,
  labelsVisible: boolean,
): LayerSpecification[] {
  const { manifest } = plan.tiles;
  return [
    {
      id: "areas-fill",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.areas,
      paint: ownershipPaint(ownership) as never,
    },
    {
      id: "areas-hover",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.areas,
      filter: ["==", ["get", "id"], "__none__"],
      paint: { "fill-color": "#5fc0ff", "fill-opacity": 0.18 },
    },
    {
      id: "areas-selected",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.areaOutlines,
      filter: ["==", ["get", "id"], ""],
      paint: { "line-color": "#ffffff", "line-width": 2.5 },
    },
    {
      id: "areas-hover-line",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.areaOutlines,
      filter: ["==", ["get", "id"], "__none__"],
      paint: { "line-color": "#9fe0ff", "line-width": 1.8 },
    },
    {
      id: "areas-line",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.areaOutlines,
      paint: { "line-color": "#3f9f8c", "line-width": 0.7, "line-opacity": 0.5 },
    },
    {
      id: "area-labels-list",
      type: "symbol",
      source: "land",
      "source-layer": manifest.layers.areaLabels,
      layout: {
        visibility: labelsVisible ? "visible" : "none",
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
  ];
}

function overlayLayers(
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

function markerLayers(visibility: ReturnType<typeof adapterLayerVisibility>): LayerSpecification[] {
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

export function mapLayers(plan: BakedLandPlan, inputs: MapLayerInputs): LayerSpecification[] {
  const visibility = adapterLayerVisibility(inputs.layers);
  const specs = [
    ...terrainLayers(plan),
    ...areaLayers(plan, inputs.ownership, visibility.labels),
    ...overlayLayers(visibility),
    ...markerLayers(visibility),
  ];
  if (inputs.variant !== "command") return specs;
  return specs.map((spec) =>
    AREA_LAYER_IDS.has(spec.id)
      ? { ...spec, layout: { ...spec.layout, visibility: "none" } }
      : spec,
  ) as LayerSpecification[];
}
