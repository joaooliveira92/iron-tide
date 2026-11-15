import type { LayerSpecification } from "maplibre-gl";

import type { useLandPlan } from "../globe-spike/use-land-plan.js";
import type { LayerId } from "../world-map/map-state.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";
import { adapterLayerVisibility, ownershipPaintValues } from "./adapter-layer-state.js";
import { srgbToCanvasHex } from "./display-color.js";
import { markerLayers, overlayLayers } from "./map-overlay-layers.js";

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
