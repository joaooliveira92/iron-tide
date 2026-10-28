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

import { campaignNationHue } from "../../content/presentationContent.js";
import { AREAS } from "../world-map/map-geometry.js";
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
import {
  adapterFailureRequested,
  adapterLandMode,
  type AdapterLandMode,
} from "./globe-adapter-flag.js";
import {
  fitWorldCamera,
  returnToNorth,
  type AppCameraState,
  type CameraProjection,
} from "./camera-contract.js";
import type { OverlayFeature, OverlaySnapshot } from "./overlay-contract.js";
import { DisposalRegistry } from "./disposal.js";
import { projectOverlay } from "./overlay-projection.js";
import { OverlayStore } from "./overlay-store.js";
import { selectPointerTarget } from "./pointer-visibility.js";
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

export interface GlobeAdapterProps {
  readonly state: WorldMapChartProps["state"];
  readonly route: WorldMapChartProps["route"];
  readonly overlay: NonNullable<WorldMapChartProps["overlay"]>;
  readonly orders?: WorldMapChartProps["orders"];
  readonly className?: string;
  readonly onSelect: WorldMapChartProps["onSelect"];
  readonly onRuler: WorldMapChartProps["onRuler"];
  readonly onUnavailable: (reason: string) => void;
  readonly forceFailure?: boolean;
  readonly landMode?: AdapterLandMode;
}

export interface AdapterDiagnostics {
  readonly zoom: number;
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
        areaId: feature.areaId ?? "",
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
  const entries = [...overlay.ownership]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([area, nation]) => [
      area,
      nation === null ? "#64748b" : `hsl(${campaignNationHue(nation)} 55% 42%)`,
    ]);
  if (entries.length === 0) return { "fill-color": "#46647f", "fill-opacity": 0.45 };
  return {
    "fill-color": ["match", ["get", "id"], ...entries, "#46647f"],
    "fill-opacity": 0.45,
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
  };
}

function mapLayers(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
  overlay: GlobeAdapterProps["overlay"],
): LayerSpecification[] {
  const { manifest } = plan.tiles;
  return [
    { id: "ocean", type: "background", paint: { "background-color": "#0b2a3f" } },
    {
      id: "land",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.land,
      paint: { "fill-color": "#33473b" },
    },
    {
      id: "land-line",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.land,
      paint: { "line-color": "#9cc2ae", "line-width": 0.8 },
    },
    {
      id: "protected-water",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.protected,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0b2a3f", "line-width": ["get", "width"] },
    },
    {
      id: "areas-fill",
      type: "fill",
      source: "land",
      "source-layer": manifest.layers.areas,
      paint: ownershipPaint(overlay) as never,
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
      id: "areas-line",
      type: "line",
      source: "land",
      "source-layer": manifest.layers.areaOutlines,
      paint: { "line-color": "#5fc0ff", "line-width": 0.8, "line-opacity": 0.55 },
    },
    {
      id: "area-labels-list",
      type: "symbol",
      source: "land",
      "source-layer": manifest.layers.areaLabels,
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
      id: "adapter-routes",
      type: "line",
      source: "adapter-routes",
      layout: { "line-cap": "round", "line-join": "round" },
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
      paint: {
        "circle-radius": ["match", ["get", "markerClass"], "fleet", 7, 5],
        "circle-color": [
          "match",
          ["get", "markerClass"],
          "fleet",
          "#5fc0ff",
          "alert",
          "#ff5c5c",
          "#ffd24a",
        ],
        "circle-stroke-color": "#001018",
        "circle-stroke-width": 1.5,
        "circle-opacity": ["case", ["boolean", ["feature-state", "hidden"], false], 0, 1],
      },
    },
    {
      id: "adapter-marker-labels",
      type: "symbol",
      source: "adapter-markers",
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
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-radius": 12,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
  ];
}

function buildStyle(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
  overlay: GlobeAdapterProps["overlay"],
): StyleSpecification {
  return {
    version: 8,
    glyphs: `${baseDirectory()}map-spike/glyphs/{fontstack}/{range}.pbf`,
    projection: { type: "globe" },
    sources: mapSources(plan),
    layers: mapLayers(plan, overlay),
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
  onUnavailable,
  forceFailure = false,
  landMode,
}: GlobeAdapterProps) {
  const hash = window.location.hash;
  const mode: AdapterLandMode = landMode ?? adapterLandMode(hash);
  const plan = useLandPlan(mode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const storeRef = useRef<OverlayStore | null>(null);
  const cacheRef = useRef<TileCache | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedAreaRef = useRef<string | null>(null);
  const projectionRef = useRef<CameraProjection>("globe");
  const hoverFrameRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [projection, setProjection] = useState<CameraProjection>("globe");
  const [status, setStatus] = useState("starting");
  const [liveMessage, setLiveMessage] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [camera, setCamera] = useState<AppCameraState>(() => fitWorldCamera("globe"));
  const initialCameraRef = useRef(camera);
  const initialOverlayRef = useRef(overlay);

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
    map.setLayoutProperty(
      "area-labels-list",
      "visibility",
      state.layers.labels ? "visible" : "none",
    );
    map.setLayoutProperty("adapter-routes", "visibility", state.layers.routes ? "visible" : "none");
  }, [ready, state.layers.labels, state.layers.routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const paint = ownershipPaint(overlay) as Record<string, unknown>;
    map.setPaintProperty("areas-fill", "fill-color", paint["fill-color"] as never);
    map.setPaintProperty("areas-fill", "fill-opacity", paint["fill-opacity"] as never);
  }, [overlay, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setFilter("areas-selected", ["==", ["get", "id"], state.selected ?? "__none__"]);
    map.setFilter("adapter-selected-ring", ["==", ["get", "areaId"], state.selected ?? "__none__"]);
    selectedAreaRef.current = state.selected;
  }, [ready, state.selected]);

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
        style: buildStyle(plan, initialOverlayRef.current),
        center: [initialCameraRef.current.centre[0], initialCameraRef.current.centre[1]],
        zoom: initialCameraRef.current.zoom,
        bearing: initialCameraRef.current.bearing,
        pitch: initialCameraRef.current.pitch,
        maxZoom: hierarchy.displayMaxZoom,
        fadeDuration: 0,
        attributionControl: false,
        canvasContextAttributes: { antialias: true },
      });
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
      if (shiftKey) onRuler(areaId);
      else onSelect(areaId);
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
        const hits = active.queryRenderedFeatures([event.point.x, event.point.y], {
          layers: ["adapter-markers"],
        });
        const next = hits.length === 0 ? null : String(hits[0]?.properties?.id ?? "");
        if (next !== hoveredRef.current) {
          hoveredRef.current = next;
          store.setHovered(next);
          active.getCanvas().style.cursor = next === null ? "" : "pointer";
        }
      });
    };
    active.on("idle", onIdle);
    active.on("error", onError);
    active.on("click", onClick);
    active.on("mousemove", onMove);
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

    disposal.add(() => active.off("idle", onIdle));
    disposal.add(() => active.off("error", onError));
    disposal.add(() => active.off("click", onClick));
    disposal.add(() => active.off("mousemove", onMove));
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

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const map = mapRef.current;
      if (map === null) return;
      const step = 120;
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
        "0": () => {
          const next = fitWorldCamera(projectionRef.current);
          map.jumpTo({
            center: [next.centre[0], next.centre[1]],
            zoom: next.zoom,
            bearing: 0,
            pitch: 0,
          });
        },
        n: () => map.setBearing(0),
        N: () => map.setBearing(0),
        Escape: () => onSelect(null),
      };
      const handler = handlers[event.key];
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    },
    [onSelect],
  );

  const setProjectionMode = useCallback((next: CameraProjection) => {
    const map = mapRef.current;
    if (map === null) return;
    map.setProjection({ type: next });
    setProjection(next);
    projectionRef.current = next;
  }, []);

  const hierarchy: TileHierarchy = NATURAL_EARTH_HIERARCHY;
  const statusLabel = errorText === null ? status : `error ${errorText}`;

  return (
    <div
      data-testid="globe-adapter"
      data-globe-adapter-projection={projection}
      className={`fixed inset-0 z-[9998] bg-black ${className ?? ""}`}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label="Strategic world map, experimental globe adapter. Use arrow keys to pan, plus and minus to zoom, zero to fit the world, n for north. A list of map entities is keyboard accessible."
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute inset-0"
        style={MAP_CONTAINER_STYLE}
      />
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded bg-black/75 px-2 py-1 font-mono text-xs text-white">
        <span data-testid="globe-adapter-status">{statusLabel}</span>
        <button
          type="button"
          className="rounded border border-white/40 px-1"
          onClick={() => setProjectionMode(projection === "globe" ? "mercator" : "globe")}
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
      <nav
        aria-label="Globe adapter entities"
        className="absolute right-2 top-2 z-10 max-h-[60vh] w-56 overflow-auto rounded bg-black/80 p-2 text-xs text-white"
      >
        <ul className="grid gap-1">
          {entityRows.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                aria-pressed={state.selected === entity.areaId}
                data-adapter-entity={entity.id}
                className="w-full rounded border border-white/40 px-2 py-1 text-left aria-pressed:bg-white aria-pressed:text-black"
                onClick={() => {
                  onSelect(entity.areaId);
                  setLiveMessage(`Selected ${entity.name}`);
                }}
              >
                {entity.name} <span className="opacity-70">({entity.kind})</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div aria-live="polite" role="status" data-testid="globe-adapter-live" className="sr-only">
        {liveMessage}
      </div>
      <table className="sr-only">
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
      <button
        type="button"
        className="absolute bottom-3 left-3 z-10 rounded bg-black/75 px-2 py-1 text-xs text-white"
        onClick={() => {
          const next = returnToNorth(camera);
          mapRef.current?.jumpTo({
            center: [next.centre[0], next.centre[1]],
            bearing: next.bearing,
          });
        }}
      >
        Reset view
      </button>
    </div>
  );
}
