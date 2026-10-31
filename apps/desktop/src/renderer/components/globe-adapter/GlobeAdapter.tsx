import {
  Map as MapLibreMap,
  addProtocol,
  removeProtocol,
  setWorkerUrl,
  type GeoJSONSource,
  type LayerSpecification,
  type SourceSpecification,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AREAS, AREAS_BY_ID } from "../world-map/map-geometry.js";
import { formatFixed } from "../../lib/presentation-format/index.js";
import {
  BAKED_PROTOCOL,
  createBakedTileLoader,
  tileUrlTemplate,
} from "../globe-spike/baked-tiles.js";
import { classifyHorizon, type GlobeCamera } from "../globe-spike/horizon.js";
import { MAP_CONTAINER_STYLE, hasRenderableSize } from "../globe-spike/map-container.js";
import { useLandPlan } from "../globe-spike/use-land-plan.js";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import { MAP_VARIANT_LAYOUT } from "../world-map/map-variant-layout.js";
import { homeFocusPoint } from "../world-map/campaign-map-join.js";
import { nationFocusPoint } from "../world-map/useInitialFocusArea.js";
import {
  adapterFailureRequested,
  adapterLandMode,
  type AdapterLandMode,
} from "./globe-adapter-flag.js";
import { fitWorldCamera, type AppCameraState, type CameraProjection } from "./camera-contract.js";
import type { OverlayFeature, OverlaySnapshot } from "./overlay-contract.js";
import { DisposalRegistry } from "./disposal.js";
import { FLEET_GLYPH_ID, buildFleetGlyph } from "./fleet-glyph.js";
import { srgbToCanvasHex } from "./display-color.js";
import { projectOverlay } from "./overlay-projection.js";
import { OverlayStore } from "./overlay-store.js";
import { selectPointerTarget } from "./pointer-visibility.js";
import {
  adapterLayerVisibility,
  adapterProjectionFromApp,
  appProjectionFromAdapter,
  buildBorderCollection,
  buildFrontierCollection,
  buildGraticuleCollection,
  borderColorExpression,
  fleetGlyphFilter,
  markerFilter,
  nationMarkerColor,
  overlayClassFilter,
  ownershipPaintValues,
} from "./adapter-layer-state.js";
import { deriveAdapterModel } from "./adapter-derivations.js";
import { GlobeAdapterChrome } from "./GlobeAdapterChrome.js";
import {
  adapterDrop,
  dragThresholdMet,
  fleetIdFromMarker,
  isDraggableFleet,
  routeAnnouncement,
} from "./adapter-interaction.js";
import {
  NATURAL_EARTH_HIERARCHY,
  TileCache,
  hierarchyForManifest,
  isOverscaled,
  selectTiles,
  sourceLevelForDisplay,
  tileCacheKey,
  type TileHierarchy,
} from "./tile-hierarchy.js";

export const GLOBE_ASSET_ROOT = "map-assets";

export interface GlobeAdapterProps {
  readonly state: WorldMapChartProps["state"];
  readonly route: WorldMapChartProps["route"];
  readonly overlay: NonNullable<WorldMapChartProps["overlay"]>;
  readonly orders?: WorldMapChartProps["orders"];
  readonly className?: string;
  readonly onSelect: WorldMapChartProps["onSelect"];
  readonly onRuler: WorldMapChartProps["onRuler"];
  readonly onToggleLayer: WorldMapChartProps["onToggleLayer"];
  readonly onSetProjection: WorldMapChartProps["onSetProjection"];
  readonly onSetCentre: WorldMapChartProps["onSetCentre"];
  readonly onUnavailable: (reason: string) => void;
  readonly forceFailure?: boolean;
  readonly landMode?: AdapterLandMode;
  readonly variant?: MapVariant;
  readonly showMinimap?: boolean;
  readonly initialFocusAreaId?: string | null;
  readonly initialFocusNationId?: string | null;
}

export interface AdapterDiagnostics {
  readonly zoom: number;
  readonly centre: readonly [number, number];
  readonly bearing: number;
  readonly pitch: number;
  readonly projection: CameraProjection;
  readonly sourceLevel: number;
  readonly overscaled: boolean;
  readonly visibleTiles: number;
  readonly storeVersion: number;
  readonly markerCount: number;
  readonly routeCount: number;
  readonly cache: ReturnType<TileCache["stats"]>;
  readonly errors: readonly string[];
}

declare global {
  interface Window {
    __globeAdapter?: {
      readonly diagnostics: () => AdapterDiagnostics;
      readonly updateMarker: (id: string, lon: number, lat: number) => boolean;
      readonly setMarkerVisible: (id: string, visible: boolean) => boolean;
      readonly benchmarkMarkers: (count: number) => {
        readonly requested: number;
        readonly applied: number;
        readonly ms: number;
        readonly storeVersion: number;
        readonly markerCount: number;
      };
      readonly benchmarkBatch: (count: number) => {
        readonly requested: number;
        readonly applied: number;
        readonly ms: number;
        readonly storeVersion: number;
      };
      readonly selectArea: (id: string | null) => void;
      readonly featureIds: () => readonly string[];
      readonly featureScreenPoint: (
        id: string,
      ) => { readonly x: number; readonly y: number } | null;
      readonly areaScreenPoint: (id: string) => { readonly x: number; readonly y: number } | null;
      readonly areaLabelsRendered: () => number;
      readonly jumpTo: (lon: number, lat: number, zoom: number) => void;
      readonly setProjection: (projection: CameraProjection) => void;
      readonly whenIdle: () => Promise<void>;
    };
  }
}

const EMPTY_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [] as GeoJSON.Feature[],
};

function baseDirectory(): string {
  const href = document.baseURI;
  return href.slice(0, href.lastIndexOf("/") + 1);
}

function featureCollection(features: readonly OverlayFeature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      id: feature.id,
      properties: {
        id: feature.id,
        name: feature.label ?? feature.id,
        kind: feature.kind,
        markerClass: feature.markerClass ?? "",
        routeClass: feature.routeClass ?? "",
        overlayClass: feature.overlayClass ?? "",
        areaId: feature.areaId ?? "",
        nationId: feature.nationId ?? "",
        color: nationMarkerColor(feature.nationId),
        lon: feature.geometry.type === "Point" ? feature.geometry.lon : 0,
        lat: feature.geometry.type === "Point" ? feature.geometry.lat : 0,
      },
      geometry:
        feature.geometry.type === "Point"
          ? { type: "Point", coordinates: [feature.geometry.lon, feature.geometry.lat] }
          : {
              type: "LineString",
              coordinates: feature.geometry.coordinates.map((point) => [...point]),
            },
    })),
  };
}

function markerCollection(snapshot: OverlaySnapshot): GeoJSON.FeatureCollection {
  return featureCollection(snapshot.features.filter((feature) => feature.kind === "marker"));
}

function routeCollection(snapshot: OverlaySnapshot): GeoJSON.FeatureCollection {
  return featureCollection(snapshot.features.filter((feature) => feature.kind === "route"));
}

function ownershipPaint(overlay: GlobeAdapterProps["overlay"]): LayerSpecification["paint"] {
  const paint = ownershipPaintValues({ ownership: overlay.ownership }, true);
  return {
    "fill-color": paint.color,
    "fill-opacity": paint.opacity,
  } as LayerSpecification["paint"];
}

function mapSources(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
): Record<string, SourceSpecification> {
  const { manifest } = plan.tiles;
  return {
    land: {
      type: "vector",
      tiles: [tileUrlTemplate()],
      minzoom: manifest.zoom.tileMin,
      maxzoom: manifest.zoom.tileMax,
      bounds: [...manifest.bounds],
      scheme: "xyz",
    },
    "adapter-markers": {
      type: "geojson",
      data: EMPTY_COLLECTION,
      promoteId: "id",
      maxzoom: 22,
      tolerance: 0,
    },
    "adapter-routes": {
      type: "geojson",
      data: EMPTY_COLLECTION,
      promoteId: "id",
      maxzoom: 22,
      tolerance: 0,
    },
    "adapter-borders": {
      type: "geojson",
      data: buildBorderCollection(),
      promoteId: "id",
      maxzoom: 22,
    },
    "adapter-border-lines": {
      type: "geojson",
      data: buildFrontierCollection(),
      promoteId: "id",
      maxzoom: 22,
    },
    "adapter-graticule": {
      type: "geojson",
      data: buildGraticuleCollection(),
      maxzoom: 22,
    },
  };
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

function climateFillColor(): unknown {
  return ["match", ["get", "zone"], ...CLIMATE_ZONE_COLORS.flat(), LAND_COLOR];
}

function mapLayers(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
  overlay: GlobeAdapterProps["overlay"],
  layers: GlobeAdapterProps["state"]["layers"],
  showAreas: boolean,
): LayerSpecification[] {
  const { manifest } = plan.tiles;
  const visibility = adapterLayerVisibility(layers);
  const specs: LayerSpecification[] = [
    { id: "ocean", type: "background", paint: { "background-color": SEA_COLOR } },
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
      id: "protected-water",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.protected,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": SEA_COLOR, "line-width": ["get", "width"] },
    },
    {
      id: "areas-fill",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.areas,
      paint: ownershipPaint(overlay) as never,
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
        visibility: visibility.labels ? "visible" : "none",
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
  if (showAreas) return specs;
  return specs.map((spec) =>
    AREA_LAYER_IDS.has(spec.id)
      ? { ...spec, layout: { ...spec.layout, visibility: "none" } }
      : spec,
  ) as LayerSpecification[];
}

function buildStyle(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
  overlay: GlobeAdapterProps["overlay"],
  layers: GlobeAdapterProps["state"]["layers"],
  showAreas: boolean,
): StyleSpecification {
  return {
    version: 8,
    glyphs: `${baseDirectory()}${GLOBE_ASSET_ROOT}/glyphs/{fontstack}/{range}.pbf`,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#bff3fb",
      "horizon-color": "#eafcff",
      "fog-color": "#eafcff",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.3,
      "fog-ground-blend": 0,
      "atmosphere-blend": 1,
    },
    sources: mapSources(plan),
    layers: mapLayers(plan, overlay, layers, showAreas),
  };
}

function cameraFromMap(map: MapLibreMap, projection: CameraProjection): GlobeCamera {
  const centre = map.getCenter();
  return {
    centre: [centre.lng, centre.lat],
    zoom: map.getZoom(),
    pitchDegrees: map.getPitch(),
    bearingDegrees: map.getBearing(),
    viewportHeightPx: map.getContainer().clientHeight,
    projection,
  } as GlobeCamera & { readonly projection: CameraProjection };
}

function horizonFor(map: MapLibreMap, lon: number, lat: number, projection: CameraProjection) {
  if (projection === "mercator") return "front" as const;
  return classifyHorizon(cameraFromMap(map, projection), [lon, lat]);
}

function mapHealth(map: MapLibreMap): boolean {
  try {
    return map.getCanvas() !== null;
  } catch {
    return false;
  }
}

export function GlobeAdapter({
  state,
  route,
  overlay,
  orders,
  className,
  onSelect,
  onRuler,
  onToggleLayer,
  onSetProjection,
  onSetCentre,
  onUnavailable,
  forceFailure = false,
  landMode,
  variant = "full",
  showMinimap = true,
  initialFocusAreaId = null,
  initialFocusNationId = null,
}: GlobeAdapterProps) {
  const showAreas = variant !== "command";
  const hash = window.location.hash;
  const mode: AdapterLandMode = landMode ?? adapterLandMode(hash);
  const plan = useLandPlan(mode, GLOBE_ASSET_ROOT);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const storeRef = useRef<OverlayStore | null>(null);
  const cacheRef = useRef<TileCache | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedAreaRef = useRef<string | null>(null);
  const projectionRef = useRef<CameraProjection>(adapterProjectionFromApp(state.projection));
  const hoverFrameRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const hoveredAreaRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [projection, setProjection] = useState<CameraProjection>(() =>
    adapterProjectionFromApp(state.projection),
  );
  const [status, setStatus] = useState("starting");
  const [liveMessage, setLiveMessage] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [camera, setCamera] = useState<AppCameraState>(() =>
    fitWorldCamera(adapterProjectionFromApp(state.projection)),
  );
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{
    readonly x: number;
    readonly y: number;
    readonly text: string;
  } | null>(null);
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null);
  const dragRef = useRef<{
    readonly fleetId: string;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    dragging: boolean;
  } | null>(null);
  const [initialCamera] = useState<AppCameraState>(() => {
    const point = homeFocusPoint(initialFocusAreaId);
    return point === null
      ? camera
      : {
          ...camera,
          centre: nationFocusPoint(point, initialFocusNationId),
          zoom: 3.5,
          bearing: 0,
          pitch: 0,
        };
  });
  const initialOverlayRef = useRef(overlay);
  const initialLayersRef = useRef(state.layers);
  const derived = useMemo(
    () => deriveAdapterModel(overlay, state.selected),
    [overlay, state.selected],
  );
  const derivedRef = useRef(derived);
  const ordersRef = useRef(orders);
  derivedRef.current = derived;
  ordersRef.current = orders;

  projectionRef.current = projection;

  const entityRows = useMemo(() => {
    const ports = [...overlay.ports]
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map((port) => ({
        id: `port:${port.id}`,
        name: port.name,
        kind: "port" as const,
        areaId: port.area,
      }));
    const fleets = [...overlay.fleets]
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map((fleet) => ({
        id: `fleet:${fleet.id}`,
        name: fleet.name,
        kind: "fleet" as const,
        areaId: fleet.area,
      }));
    return [...ports, ...fleets];
  }, [overlay.fleets, overlay.ports]);

  const applyProjection = useCallback(() => {
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
  }, [orders, overlay, ready, route, state]);

  useEffect(() => {
    applyProjection();
  }, [applyProjection]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const visibility = adapterLayerVisibility(state.layers);
    const set = (id: string, visible: boolean) =>
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    set("area-labels-list", showAreas && visibility.labels);
    set("adapter-borders-fill", visibility.borders);
    set("adapter-borders-line", visibility.borders);
    set("adapter-graticule", visibility.graticule);
    set("adapter-lanes", visibility.lanes);
    set("adapter-routes", visibility.routes);
    map.setFilter("adapter-markers", markerFilter(visibility) as never);
    map.setFilter("adapter-fleet-glyphs", fleetGlyphFilter(visibility) as never);
    map.setFilter("adapter-marker-labels", markerFilter(visibility) as never);
  }, [ready, showAreas, state.layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const next = adapterProjectionFromApp(state.projection);
    if (next !== projectionRef.current) {
      map.setProjection({ type: next });
      setProjection(next);
      projectionRef.current = next;
    }
  }, [ready, state.projection]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setCenter([state.centre, map.getCenter().lat]);
  }, [ready, state.centre]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const paint = ownershipPaintValues({ ownership: overlay.ownership }, state.layers.ownership);
    map.setPaintProperty("areas-fill", "fill-color", paint.color as never);
    map.setPaintProperty("areas-fill", "fill-opacity", paint.opacity);
  }, [overlay, ready, state.layers.ownership]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setFilter("areas-selected", ["==", ["get", "id"], state.selected ?? "__none__"]);
    map.setFilter("adapter-selected-ring", ["==", ["get", "areaId"], state.selected ?? "__none__"]);
    selectedAreaRef.current = state.selected;
  }, [ready, state.selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const filter = ["==", ["get", "id"], hoveredArea ?? "__none__"];
    map.setFilter("areas-hover", filter as never);
    map.setFilter("areas-hover-line", filter as never);
  }, [hoveredArea, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setFilter("adapter-selected-fleet-ring", [
      "==",
      ["get", "id"],
      selectedFleet === null ? "" : `fleet:${selectedFleet}`,
    ]);
  }, [ready, selectedFleet]);

  useEffect(() => {
    setLiveMessage(routeAnnouncement(route));
  }, [route]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    if (plan.kind === "loading") return;
    if (plan.kind === "failed") {
      onUnavailable(plan.reason);
      return;
    }
    if (plan.kind === "runtime") {
      onUnavailable(plan.reason ?? "tile pack unavailable");
      return;
    }
    if (!hasRenderableSize(container.clientWidth, container.clientHeight)) {
      onUnavailable("map container has no renderable size");
      return;
    }
    if (forceFailure || adapterFailureRequested(window.location.hash)) {
      onUnavailable("forced adapter failure");
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    let hierarchy: TileHierarchy;
    try {
      hierarchy = hierarchyForManifest(NATURAL_EARTH_HIERARCHY, plan.tiles.manifest);
    } catch (error) {
      onUnavailable(error instanceof Error ? error.message : String(error));
      return;
    }
    const disposal = new DisposalRegistry();
    disposal.add(() => abort.abort());
    const cache = new TileCache(hierarchy);
    disposal.add(() => cache.dispose());
    cacheRef.current = cache;
    const store = new OverlayStore({ disposeSignal: abort.signal });
    storeRef.current = store;
    disposal.add(() => store.dispose());
    const errors: string[] = [];
    let registeredProtocol = false;
    let map: MapLibreMap | null = null;
    const baseLoader = createBakedTileLoader(plan.tiles.pack, plan.tiles.diagnostics);
    try {
      setWorkerUrl(new URL(workerUrl, document.baseURI).href);
      addProtocol(BAKED_PROTOCOL, async (params) => {
        const match = /(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
        if (match === null) return baseLoader(params);
        const key = tileCacheKey(
          { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) },
          hierarchy,
        );
        if (cache.get(key) !== null) return baseLoader(params);
        if (!cache.begin(key)) {
          errors.push(`tile cache in-flight budget reached at ${params.url}`);
          return { data: new ArrayBuffer(0) };
        }
        try {
          const response = await baseLoader(params);
          cache.complete(key, response.data.byteLength);
          return response;
        } catch (error) {
          cache.fail(key);
          throw error;
        }
      });
      registeredProtocol = true;
      map = new MapLibreMap({
        container,
        style: buildStyle(plan, initialOverlayRef.current, initialLayersRef.current, showAreas),
        center: [initialCamera.centre[0], initialCamera.centre[1]],
        zoom: initialCamera.zoom,
        bearing: initialCamera.bearing,
        pitch: initialCamera.pitch,
        maxZoom: hierarchy.displayMaxZoom,
        fadeDuration: 0,
        attributionControl: false,
        canvasContextAttributes: { antialias: true },
      });
      map.boxZoom.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
    } catch (error) {
      if (registeredProtocol) removeProtocol(BAKED_PROTOCOL);
      store.dispose();
      cache.dispose();
      onUnavailable(error instanceof Error ? error.message : String(error));
      return;
    }
    const active = map;
    mapRef.current = active;
    const unsubscribe = store.subscribe((changeSet) => {
      if (changeSet.changes.length === 0) return;
      const snapshot = store.snapshot();
      const markers = active.getSource("adapter-markers") as GeoJSONSource | undefined;
      const routes = active.getSource("adapter-routes") as GeoJSONSource | undefined;
      void markers?.setData(markerCollection(snapshot));
      void routes?.setData(routeCollection(snapshot));
    });
    disposal.add(unsubscribe);
    const unsubscribeVisibility = store.subscribeVisibility((change) => {
      active.setFeatureState(
        { source: "adapter-markers", id: change.id },
        { hidden: !change.visible },
      );
      active.setFeatureState(
        { source: "adapter-routes", id: change.id },
        { hidden: !change.visible },
      );
    });
    disposal.add(unsubscribeVisibility);

    const onIdle = () => {
      if (!mapHealth(active)) {
        errors.push("renderer health check failed");
        onUnavailable("renderer health check failed");
        return;
      }
      const zoom = active.getZoom();
      const selection = selectTiles(
        {
          centre: [active.getCenter().lng, active.getCenter().lat],
          zoom,
          pitchDegrees: active.getPitch(),
          bearingDegrees: active.getBearing(),
          viewport: {
            width: active.getContainer().clientWidth,
            height: active.getContainer().clientHeight,
          },
          dpr: window.devicePixelRatio,
          mode: projectionRef.current,
        },
        hierarchy,
      );
      setStatus(
        `idle z=${formatFixed(zoom, { locale: "en-US", digits: 2 })} source z${selection.level}${selection.overscaled ? " overscaled" : ""} tiles=${selection.tiles.length}`,
      );
      setCamera((current) => ({
        ...current,
        centre: [active.getCenter().lng, active.getCenter().lat],
        zoom,
        bearing: active.getBearing(),
        pitch: active.getPitch(),
        projection: projectionRef.current,
      }));
    };
    const onError = (event: { readonly error?: { readonly message?: string } }) => {
      const message = event.error?.message ?? "unknown";
      errors.push(message);
      setErrorText(message);
    };
    const pick = (x: number, y: number, shiftKey: boolean) => {
      const hits = active.queryRenderedFeatures([x, y], { layers: ["adapter-markers"] });
      const candidates = hits.map((feature) => {
        const properties = feature.properties ?? {};
        const lon = Number(properties.lon);
        const lat = Number(properties.lat);
        return {
          id: String(properties.id ?? ""),
          rendered: true,
          projectVisible: true,
          horizon: horizonFor(active, lon, lat, projectionRef.current),
        };
      });
      const target = selectPointerTarget(candidates);
      if (target !== null) {
        const hit = hits.find((feature) => String(feature.properties?.id) === target);
        const areaId = String(hit?.properties?.areaId ?? "");
        const markerId = String(hit?.properties?.id ?? "");
        const fleetId = fleetIdFromMarker(markerId);
        if (!shiftKey && fleetId !== null) {
          ordersRef.current?.onSelectFleet(fleetId);
          setSelectedFleet(fleetId);
          setLiveMessage(`Selected fleet ${String(hit?.properties?.name ?? fleetId)}`);
          return;
        }
        if (areaId.length > 0) {
          if (shiftKey) onRuler(areaId);
          else onSelect(areaId);
          setLiveMessage(
            `${shiftKey ? "Route from " : "Selected "}${String(hit?.properties?.name ?? areaId)}`,
          );
        }
        return;
      }
      const areas = active.queryRenderedFeatures([x, y], { layers: ["areas-fill"] });
      const areaId = areas.length === 0 ? null : String(areas[0]?.properties?.id ?? "");
      if (areaId === null || areaId.length === 0) {
        if (!shiftKey) onSelect(null);
        return;
      }
      if (shiftKey) {
        onRuler(areaId);
        setLiveMessage(`Route via ${derivedRef.current.areaName(areaId)}`);
      } else {
        onSelect(areaId);
        setLiveMessage(`Selected ${derivedRef.current.describeAreaFor(areaId)}`);
      }
    };
    const onClick = (event: {
      readonly point: { readonly x: number; readonly y: number };
      readonly originalEvent: MouseEvent;
    }) => {
      pick(event.point.x, event.point.y, event.originalEvent.shiftKey);
    };
    const onMove = (event: { readonly point: { readonly x: number; readonly y: number } }) => {
      if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = requestAnimationFrame(() => {
        const markerHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
          layers: ["adapter-markers"],
        });
        const markerId =
          markerHits.length === 0 ? null : String(markerHits[0]?.properties?.id ?? "");
        if (markerId !== hoveredRef.current) {
          hoveredRef.current = markerId;
          store.setHovered(markerId);
        }
        const areaHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
          layers: ["areas-fill"],
        });
        const areaId = areaHits.length === 0 ? null : String(areaHits[0]?.properties?.id ?? "");
        if (areaId !== hoveredAreaRef.current) {
          hoveredAreaRef.current = areaId;
          setHoveredArea(areaId);
        }
        if (areaId === null) {
          setHoverTooltip(null);
        } else {
          setHoverTooltip({
            x: event.point.x,
            y: event.point.y,
            text: derivedRef.current.describeAreaFor(areaId),
          });
        }
        active.getCanvas().style.cursor =
          markerId === null ? (areaId === null ? "" : "crosshair") : "pointer";
      });
    };
    const onMouseOut = () => {
      hoveredRef.current = null;
      hoveredAreaRef.current = null;
      store.setHovered(null);
      setHoveredArea(null);
      setHoverTooltip(null);
    };
    const canvas = active.getCanvas();
    const pointOf = (event: PointerEvent): { readonly x: number; readonly y: number } => {
      const box = canvas.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const onPointerDown = (event: PointerEvent) => {
      const currentOrders = ordersRef.current;
      if (currentOrders === undefined || event.button !== 0) return;
      const at = pointOf(event);
      const hits = active.queryRenderedFeatures([at.x, at.y], { layers: ["adapter-markers"] });
      const markerId = hits.length === 0 ? null : String(hits[0]?.properties?.id ?? "");
      const fleetId = fleetIdFromMarker(markerId);
      if (!isDraggableFleet(currentOrders, fleetId) || fleetId === null) return;
      active.dragPan.disable();
      canvas.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        fleetId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      currentOrders.onSelectFleet(fleetId);
      setSelectedFleet(fleetId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId || drag.dragging) return;
      if (
        dragThresholdMet({ x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY })
      ) {
        drag.dragging = true;
        canvas.style.cursor = "grabbing";
      }
    };
    const endDrag = (event: PointerEvent, drop: boolean) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      active.dragPan.enable();
      canvas.style.cursor = "";
      dragRef.current = null;
      if (!drop || !drag.dragging) return;
      const at = pointOf(event);
      const areas = active.queryRenderedFeatures([at.x, at.y], { layers: ["areas-fill"] });
      const areaId = areas.length === 0 ? null : String(areas[0]?.properties?.id ?? "");
      const currentOrders = ordersRef.current;
      const resolution = adapterDrop(currentOrders, drag.fleetId, areaId);
      if (resolution.kind === "ignored") {
        setLiveMessage("That fleet destination is not available.");
        return;
      }
      currentOrders?.onDrop(drag.fleetId, areaId as string);
      setLiveMessage(
        `Ordered fleet to ${areaId === null ? "an area" : derivedRef.current.areaName(areaId)}`,
      );
    };
    const onPointerUp = (event: PointerEvent) => endDrag(event, true);
    const onPointerCancel = (event: PointerEvent) => endDrag(event, false);
    const onImageMissing = (event: { readonly id: string }) => {
      if (event.id !== FLEET_GLYPH_ID || active.hasImage(FLEET_GLYPH_ID)) return;
      active.addImage(FLEET_GLYPH_ID, buildFleetGlyph(), { sdf: true });
    };
    active.on("styleimagemissing", onImageMissing);
    active.on("idle", onIdle);
    active.on("error", onError);
    active.on("click", onClick);
    active.on("mousemove", onMove);
    active.on("mouseout", onMouseOut);
    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointermove", onPointerMove, true);
    canvas.addEventListener("pointerup", onPointerUp, true);
    canvas.addEventListener("pointercancel", onPointerCancel, true);
    active.once("load", () => {
      setReady(true);
      onIdle();
    });

    const waitIdle = (): Promise<void> =>
      new Promise((resolve) => {
        if (active.loaded() && !active.isMoving()) {
          requestAnimationFrame(() => resolve());
          return;
        }
        active.once("idle", () => resolve());
      });

    window.__globeAdapter = {
      diagnostics: () => {
        const selection = selectTiles(
          {
            centre: [active.getCenter().lng, active.getCenter().lat],
            zoom: active.getZoom(),
            pitchDegrees: active.getPitch(),
            bearingDegrees: active.getBearing(),
            viewport: {
              width: active.getContainer().clientWidth,
              height: active.getContainer().clientHeight,
            },
            dpr: window.devicePixelRatio,
            mode: projectionRef.current,
          },
          hierarchy,
        );
        const snapshot = store.snapshot();
        return {
          zoom: active.getZoom(),
          centre: [active.getCenter().lng, active.getCenter().lat],
          bearing: active.getBearing(),
          pitch: active.getPitch(),
          projection: projectionRef.current,
          sourceLevel: sourceLevelForDisplay(active.getZoom(), hierarchy),
          overscaled: isOverscaled(active.getZoom(), hierarchy),
          visibleTiles: selection.tiles.length,
          storeVersion: snapshot.version,
          markerCount: snapshot.features.filter((feature) => feature.kind === "marker").length,
          routeCount: snapshot.features.filter((feature) => feature.kind === "route").length,
          cache: cache.stats(),
          errors,
        };
      },
      updateMarker: (id, lon, lat) => {
        const current = store.snapshot().features.find((feature) => feature.id === id);
        if (current === undefined || current.geometry.type !== "Point") return false;
        store.apply([
          {
            type: "upsert",
            id,
            feature: { ...current, geometry: { type: "Point", lon, lat } },
          },
        ]);
        return true;
      },
      setMarkerVisible: (id, visible) => store.setVisible(id, visible) !== null,
      benchmarkMarkers: (count) => {
        const total = Math.max(0, Math.min(5000, Math.floor(count)));
        const changes = Array.from({ length: total }, (_, index) => {
          const area = AREAS[index % AREAS.length] as (typeof AREAS)[number];
          const feature = {
            id: `bench-marker-${index}`,
            kind: "marker" as const,
            order: 10_000 + index,
            minZoom: 0,
            markerClass: "port" as const,
            label: `Bench ${index}`,
            areaId: area.id,
            geometry: { type: "Point" as const, lon: area.label[0], lat: area.label[1] },
          };
          return { type: "upsert" as const, id: feature.id, feature };
        });
        const started = performance.now();
        const changeSet = store.apply(changes);
        const ms = performance.now() - started;
        return {
          requested: total,
          applied: changeSet.changes.length,
          ms: Math.round(ms * 1000) / 1000,
          storeVersion: changeSet.version,
          markerCount: store.snapshot().features.filter((feature) => feature.kind === "marker")
            .length,
        };
      },
      benchmarkBatch: (count) => {
        const total = Math.max(0, Math.min(5000, Math.floor(count)));
        const changes = Array.from({ length: total }, (_, index) => {
          const area = AREAS[(index * 3) % AREAS.length] as (typeof AREAS)[number];
          const id = `bench-marker-${index}`;
          const current = store.snapshot().features.find((feature) => feature.id === id);
          const feature = current ?? {
            id,
            kind: "marker" as const,
            order: 10_000 + index,
            minZoom: 0,
            markerClass: "port" as const,
            label: `Bench ${index}`,
            areaId: area.id,
            geometry: { type: "Point" as const, lon: area.label[0], lat: area.label[1] },
          };
          if (feature.geometry.type !== "Point") return null;
          return {
            type: "upsert" as const,
            id,
            feature: {
              ...feature,
              geometry: {
                type: "Point" as const,
                lon: area.label[0] + 0.01,
                lat: area.label[1] + 0.01,
              },
            },
          };
        }).filter((change): change is NonNullable<typeof change> => change !== null);
        const started = performance.now();
        const changeSet = store.apply(changes);
        return {
          requested: total,
          applied: changeSet.changes.length,
          ms: Math.round((performance.now() - started) * 1000) / 1000,
          storeVersion: changeSet.version,
        };
      },
      selectArea: (id) => onSelect(id),
      featureIds: () => store.snapshot().features.map((feature) => feature.id),
      featureScreenPoint: (id) => {
        const feature = store.snapshot().features.find((entry) => entry.id === id);
        if (feature === undefined || feature.geometry.type !== "Point") return null;
        const point = active.project([feature.geometry.lon, feature.geometry.lat]);
        const rect = active.getCanvas().getBoundingClientRect();
        return { x: rect.left + point.x, y: rect.top + point.y };
      },
      areaScreenPoint: (id) => {
        const area = AREAS_BY_ID.get(id);
        if (area === undefined) return null;
        const point = active.project([area.label[0], area.label[1]]);
        const rect = active.getCanvas().getBoundingClientRect();
        return { x: rect.left + point.x, y: rect.top + point.y };
      },
      areaLabelsRendered: () =>
        active.queryRenderedFeatures({ layers: ["area-labels-list"] }).length,
      jumpTo: (lon, lat, zoom) => active.jumpTo({ center: [lon, lat], zoom }),
      setProjection: (next) => {
        active.setProjection({ type: next });
        setProjection(next);
        projectionRef.current = next;
      },
      whenIdle: waitIdle,
    };

    disposal.add(() => active.off("styleimagemissing", onImageMissing));
    disposal.add(() => active.off("idle", onIdle));
    disposal.add(() => active.off("error", onError));
    disposal.add(() => active.off("click", onClick));
    disposal.add(() => active.off("mousemove", onMove));
    disposal.add(() => active.off("mouseout", onMouseOut));
    disposal.add(() => canvas.removeEventListener("pointerdown", onPointerDown, true));
    disposal.add(() => canvas.removeEventListener("pointermove", onPointerMove, true));
    disposal.add(() => canvas.removeEventListener("pointerup", onPointerUp, true));
    disposal.add(() => canvas.removeEventListener("pointercancel", onPointerCancel, true));
    disposal.add(() => {
      if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current);
    });
    disposal.add(() => active.remove());
    disposal.add(() => {
      if (registeredProtocol) removeProtocol(BAKED_PROTOCOL);
    });
    disposal.add(() => {
      delete window.__globeAdapter;
      setReady(false);
      mapRef.current = null;
      storeRef.current = null;
      cacheRef.current = null;
    });

    return () => disposal.dispose();
  }, [forceFailure, mode, onRuler, onSelect, onUnavailable, plan]);

  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (map === null) return;
    const next = fitWorldCamera(projectionRef.current);
    map.jumpTo({
      center: [state.centre, next.centre[1]],
      zoom: next.zoom,
      bearing: 0,
      pitch: 0,
    });
  }, [state.centre]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const map = mapRef.current;
      const fleets = orders?.fleets ?? [];
      const cycleFleet = () => {
        if (fleets.length === 0) return;
        const current = fleets.findIndex((fleet) => fleet.fleetId === orders?.selectedFleetId);
        const next = fleets[(current + 1) % fleets.length];
        if (next === undefined) return;
        orders?.onSelectFleet(next.fleetId);
        setSelectedFleet(next.fleetId);
        const anchor = next.mapAreaId === null ? null : AREAS_BY_ID.get(next.mapAreaId)?.label;
        if (map !== null && anchor !== undefined && anchor !== null) {
          map.jumpTo({ center: [anchor[0], anchor[1]], zoom: Math.max(3.5, map.getZoom()) });
        }
        setLiveMessage(`Focused fleet ${next.fleetName}`);
      };
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === "f" || event.key === "F") {
          event.preventDefault();
          cycleFleet();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setSelectedFleet(null);
          onSelect(null);
          return;
        }
      }
      if (map === null) return;
      const step = event.shiftKey ? 240 : 120;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const move = (dx: number, dy: number) =>
        map.panBy([dx, dy], { animate: !reduced, duration: reduced ? 0 : 250 });
      const handlers: Record<string, () => void> = {
        ArrowLeft: () => move(step, 0),
        ArrowRight: () => move(-step, 0),
        ArrowUp: () => move(0, step),
        ArrowDown: () => move(0, -step),
        "+": () => map.setZoom(map.getZoom() + 0.5),
        "=": () => map.setZoom(map.getZoom() + 0.5),
        "-": () => map.setZoom(map.getZoom() - 0.5),
        _: () => map.setZoom(map.getZoom() - 0.5),
        "0": resetView,
        n: () => map.setBearing(0),
        N: () => map.setBearing(0),
      };
      const handler = handlers[event.key];
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    },
    [onSelect, orders, resetView],
  );

  const setProjectionMode = useCallback((next: CameraProjection) => {
    const map = mapRef.current;
    if (map === null) return;
    map.setProjection({ type: next });
    setProjection(next);
    projectionRef.current = next;
  }, []);

  const handleSetProjection = useCallback(
    (next: NonNullable<WorldMapChartProps["state"]["projection"]>) => {
      onSetProjection(next);
      setProjectionMode(adapterProjectionFromApp(next));
    },
    [onSetProjection, setProjectionMode],
  );

  const recentre = useCallback(
    (lon: number, lat: number) => {
      mapRef.current?.jumpTo({ center: [lon, lat] });
      onSetCentre(lon);
    },
    [onSetCentre],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const point = homeFocusPoint(initialFocusAreaId);
    if (point === null) return;
    const target = nationFocusPoint(point, initialFocusNationId);
    map.jumpTo({ center: [target[0], target[1]], zoom: 3.5, bearing: 0, pitch: 0 });
  }, [initialFocusAreaId, initialFocusNationId, ready]);

  const hierarchy: TileHierarchy = NATURAL_EARTH_HIERARCHY;
  const statusLabel = errorText === null ? status : `error ${errorText}`;
  const viewport = camera;

  return (
    <div
      data-testid="globe-adapter"
      data-globe-adapter-projection={projection}
      data-globe-adapter-ready={ready ? "true" : "false"}
      data-map-variant={variant}
      className={`absolute inset-0 z-[9998] bg-[#cdf3fa] ${MAP_VARIANT_LAYOUT[variant].root} ${className ?? ""}`}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label="Strategic world map, experimental globe adapter. Use arrow keys to pan, shift plus arrow keys for a longer pan, plus and minus to zoom, zero to reset the view, f to cycle fleets, n for north and Escape to clear the selection. A list of areas, ports and fleets is keyboard accessible."
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute inset-0"
        style={MAP_CONTAINER_STYLE}
      />
      <div className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded bg-black/75 px-2 py-1 font-mono text-xs text-white">
        <span data-testid="globe-adapter-status">{statusLabel}</span>
        <button
          type="button"
          className="rounded border border-white/40 px-1"
          onClick={() =>
            handleSetProjection(
              appProjectionFromAdapter(projection === "globe" ? "mercator" : "globe"),
            )
          }
        >
          {projection === "globe" ? "Mercator" : "Globe"}
        </button>
        <button
          type="button"
          className="rounded border border-white/40 px-1"
          onClick={() => mapRef.current?.setBearing(0)}
        >
          North
        </button>
        <span className="opacity-70">z{NATURAL_EARTH_HIERARCHY.sourceMaxZoom} source</span>
      </div>
      {hoverTooltip === null ? null : (
        <div
          role="tooltip"
          data-testid="globe-adapter-tooltip"
          className="pointer-events-none absolute z-30 max-w-64 rounded bg-black/85 px-2 py-1 text-xs text-white"
          style={{ left: hoverTooltip.x + 12, top: hoverTooltip.y + 12 }}
        >
          {hoverTooltip.text}
        </div>
      )}
      <GlobeAdapterChrome
        state={state}
        route={route}
        viewport={viewport}
        variant={variant}
        showAreas={showAreas}
        treeRows={derived.treeRows}
        ownershipRows={derived.ownershipRows}
        summary={derived.summary}
        nameFor={derived.nameFor}
        onSelect={(area) => {
          onSelect(area);
          setLiveMessage(area === null ? "Selection cleared" : derived.describeAreaFor(area));
        }}
        onToggleLayer={onToggleLayer}
        onSetProjection={handleSetProjection}
        onSetCentre={onSetCentre}
        onReset={resetView}
        onRecentre={recentre}
        entityRows={entityRows}
        onSelectEntity={(entity) => {
          const fleetId = fleetIdFromMarker(entity.id);
          if (fleetId !== null) {
            orders?.onSelectFleet(fleetId);
            setSelectedFleet(fleetId);
            setLiveMessage(`Selected fleet ${entity.name}`);
            return;
          }
          onSelect(entity.areaId);
          setLiveMessage(`Selected ${derived.describeAreaFor(entity.areaId)}`);
        }}
        showMinimap={showMinimap}
      />
      <div aria-live="polite" role="status" data-testid="globe-adapter-live" className="sr-only">
        {liveMessage}
      </div>
      <div className="sr-only">
        <table>
          <caption>Globe adapter entities</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Kind</th>
              <th scope="col">Area</th>
            </tr>
          </thead>
          <tbody>
            {entityRows.map((entity) => (
              <tr key={entity.id}>
                <th scope="row">{entity.name}</th>
                <td>{entity.kind}</td>
                <td>{entity.areaId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sr-only" data-testid="globe-adapter-camera">
        {JSON.stringify(camera)}
      </div>
      <div className="sr-only" data-testid="globe-adapter-hierarchy">
        {JSON.stringify({
          version: hierarchy.version,
          sourceMaxZoom: hierarchy.sourceMaxZoom,
          fitForPurposeMaxZoom: hierarchy.fitForPurposeMaxZoom,
          overscaleMaxZoom: hierarchy.overscaleMaxZoom,
          cacheVersion: hierarchy.cacheVersion,
        })}
      </div>
    </div>
  );
}
