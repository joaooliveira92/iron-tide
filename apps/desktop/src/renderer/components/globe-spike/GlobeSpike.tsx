import {
  LngLat,
  Map as MapLibreMap,
  addProtocol,
  removeProtocol,
  setWorkerUrl,
  type LayerSpecification,
  type MapGeoJSONFeature,
  type SourceSpecification,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { formatFixed } from "../../lib/presentation-format/format.js";
import {
  BAKED_PROTOCOL,
  createBakedTileLoader,
  tileUrlTemplate,
  type BakedTiles,
} from "./baked-tiles.js";
import { GlobeSpikeError } from "./globe-spike-errors.js";
import { GLOBE_SPIKE_FAIL_HASH, landModeFromHash } from "./globe-spike-flag.js";
import {
  SPIKE_MARKERS,
  markerCollection,
  routeCollection,
  type GeoFeatureCollection,
} from "./globe-spike-scene.js";
import {
  classifyHorizon,
  edgeIndicator,
  horizonMarginRadians,
  initialBearingDegrees,
  type GlobeCamera,
  type HorizonClass,
} from "./horizon.js";
import { MAP_CONTAINER_STYLE, hasRenderableSize } from "./map-container.js";
import { MapEntityList, type MapEntity } from "./MapEntityList.js";
import { useLandPlan, type LandPlan } from "./use-land-plan.js";
import {
  areaCollection,
  areaIds,
  areaLabelCollection,
  areaLabelPoint,
  truthAreaIds,
} from "./spike-areas.js";

export type SpikeIntent =
  | { readonly type: "zoomAround"; readonly levels: number; readonly x: number; readonly y: number }
  | { readonly type: "panBy"; readonly dx: number; readonly dy: number }
  | {
      readonly type: "setView";
      readonly lon: number;
      readonly lat: number;
      readonly zoom: number;
      readonly bearing?: number;
      readonly pitch?: number;
    };

export interface ReplayResult {
  readonly zoom: number;
  readonly centre: readonly [number, number];
  readonly bearing: number;
  readonly pitch: number;
  readonly maxAnchorDriftPx: number;
}

export interface ProbeResult {
  readonly requested: number;
  readonly missing: number;
  readonly maxErrorPx: number | null;
  readonly meanErrorPx: number | null;
}

export interface GlobeSpikeApi {
  readonly jumpTo: (lon: number, lat: number, zoom: number) => void;
  readonly setView: (view: {
    lon: number;
    lat: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
  }) => void;
  readonly status: () => {
    readonly zoom: number;
    readonly centre: readonly [number, number];
    readonly globeness: number | null;
    readonly idle: boolean;
    readonly land: LandStatus;
  };
  readonly samplePixels: (
    points: readonly (readonly [number, number])[],
  ) => readonly (readonly [number, number, number])[];
  readonly bakedDiagnostics: () => BakedTiles["diagnostics"] | null;
  readonly markerRenderedPixels: (id: string) => Promise<number>;
  readonly project: (id: string) => readonly [number, number] | null;
  readonly projectLonLat: (lon: number, lat: number) => readonly [number, number];
  readonly unproject: (x: number, y: number) => readonly [number, number];
  readonly hitMarker: (id: string) => boolean;
  readonly visibleMarkerIds: () => readonly string[];
  readonly horizonPrediction: () => readonly {
    readonly id: string;
    readonly beyondHorizon: boolean;
    readonly horizonClass: HorizonClass;
    readonly marginDegrees: number;
    readonly visible: boolean;
    readonly renderedAnywhere: boolean;
  }[];
  readonly pickAreas: (x: number, y: number) => readonly string[];
  readonly truthAreas: (lon: number, lat: number) => readonly string[];
  readonly areaIds: () => readonly string[];
  readonly areaLabel: (id: string) => readonly [number, number] | null;
  readonly runProbes: (points: readonly (readonly [number, number])[]) => Promise<ProbeResult>;
  readonly applyIntent: (intent: SpikeIntent) => number;
  readonly replay: (trace: readonly SpikeIntent[]) => ReplayResult;
  readonly select: (id: string) => void;
  readonly selected: () => string | null;
  readonly selectedIndicator: () => {
    readonly visible: boolean;
    readonly x: number;
    readonly y: number;
  } | null;
  readonly canvasPaintedPixels: () => number;
  readonly errors: () => readonly string[];
  readonly labelsRendered: () => number;
  readonly whenIdle: () => Promise<void>;
  readonly liveMessage: () => string;
}

declare global {
  interface Window {
    __globeSpike?: GlobeSpikeApi;
  }
}

export interface LandStatus {
  readonly source: "baked" | "runtime";
  readonly tileMaxZoom: number | null;
  readonly fitForPurposeMaxZoom: number | null;
  readonly overscaled: boolean;
  readonly fallbackReason: string | null;
}

function landStatus(plan: LandPlan, zoom: number): LandStatus {
  if (plan.kind === "baked") {
    const { zoom: range } = plan.tiles.manifest;
    return {
      source: "baked",
      tileMaxZoom: range.tileMax,
      fitForPurposeMaxZoom: range.fitForPurposeMax,
      overscaled: zoom > range.fitForPurposeMax,
      fallbackReason: null,
    };
  }
  return {
    source: "runtime",
    tileMaxZoom: null,
    fitForPurposeMaxZoom: null,
    overscaled: false,
    fallbackReason: plan.kind === "runtime" ? plan.reason : null,
  };
}

export interface GlobeSpikeProps {
  readonly onFail: (reason: string) => void;
}

const EMPTY: GeoFeatureCollection = { type: "FeatureCollection", features: [] };

function readGlobeness(map: MapLibreMap): number | null {
  const style: unknown = Reflect.get(map, "style");
  if (typeof style !== "object" || style === null) return null;
  const projection: unknown = Reflect.get(style, "projection");
  if (typeof projection !== "object" || projection === null) return null;
  const state: unknown = Reflect.get(projection, "transitionState");
  return typeof state === "number" ? state : null;
}

function baseDirectory(): string {
  const href = document.baseURI;
  return href.slice(0, href.lastIndexOf("/") + 1);
}

type ReadyPlan = Exclude<LandPlan, { readonly kind: "loading" } | { readonly kind: "failed" }>;

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

function buildStyle(plan: ReadyPlan): StyleSpecification {
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

function entities(): readonly MapEntity[] {
  const ports: MapEntity[] = SPIKE_MARKERS.map((marker) => ({
    id: marker.id,
    name: marker.name,
    kind: "port",
  }));
  return ports;
}

function centroid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): readonly [number, number] | null {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const w = Math.min(width - x0, Math.ceil(radius * 2));
  const h = Math.min(height - y0, Math.ceil(radius * 2));
  if (w <= 0 || h <= 0) return null;
  const { data } = context.getImageData(x0, y0, w, h);
  let sumX = 0;
  let sumY = 0;
  let sumW = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      const red = data[k] ?? 0;
      const weight = Math.max(0, red - Math.max(data[k + 1] ?? 0, data[k + 2] ?? 0) - 40);
      sumX += (x0 + i + 0.5) * weight;
      sumY += (y0 + j + 0.5) * weight;
      sumW += weight;
    }
  }
  return sumW < 200 ? null : [sumX / sumW, sumY / sumW];
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function GlobeSpike({ onFail }: GlobeSpikeProps) {
  const landMode = useMemo(() => landModeFromHash(window.location.hash), []);
  const plan = useLandPlan(landMode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [statusText, setStatusText] = useState("starting");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [indicator, setIndicator] = useState<{ x: number; y: number; bearing: number } | null>(
    null,
  );
  const selectedRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useMemo(entities, []);

  useEffect(() => {
    if (plan.kind === "failed") onFail(plan.reason);
  }, [plan, onFail]);

  const reducedMotion = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const refreshIndicator = useCallback(() => {
    const map = mapRef.current;
    const id = selectedRef.current;
    if (map === null || id === null) {
      setIndicator(null);
      return;
    }
    const entry = SPIKE_MARKERS.find((candidate) => candidate.id === id);
    if (entry === undefined) return;
    const centre = map.getCenter();
    const point = map.project(new LngLat(entry.lon, entry.lat));
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    const onScreen = point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
    const rendered = map
      .queryRenderedFeatures(
        [
          [point.x - 4, point.y - 4],
          [point.x + 4, point.y + 4],
        ],
        { layers: ["markers"] },
      )
      .some((feature) => feature.properties?.id === id);
    const behind = !rendered;
    if (onScreen && !behind) {
      setIndicator(null);
      return;
    }
    const bearing = initialBearingDegrees([centre.lng, centre.lat], [entry.lon, entry.lat]);
    const placed = edgeIndicator(bearing, map.getBearing(), { width, height }, 28);
    setIndicator({ x: placed.x, y: placed.y, bearing });
  }, []);

  const select = useCallback(
    (id: string) => {
      const map = mapRef.current;
      const entry = SPIKE_MARKERS.find((candidate) => candidate.id === id);
      if (map === null || entry === undefined) return;
      selectedRef.current = id;
      setSelectedId(id);
      map.setFilter("selected-ring", ["==", ["get", "id"], id]);
      const options = {
        center: [entry.lon, entry.lat] as [number, number],
        zoom: Math.max(map.getZoom(), 3),
      };
      if (reducedMotion()) map.jumpTo(options);
      else map.easeTo({ ...options, duration: 600 });
      setLiveMessage(`Selected ${entry.name}`);
    },
    [reducedMotion],
  );

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (map === null) return;
    const step = 80;
    const move = (dx: number, dy: number) => {
      const centre = map.project(map.getCenter());
      map.jumpTo({ center: map.unproject([centre.x + dx, centre.y + dy]) });
    };
    const handlers: Record<string, () => void> = {
      ArrowLeft: () => move(-step, 0),
      ArrowRight: () => move(step, 0),
      ArrowUp: () => move(0, -step),
      ArrowDown: () => move(0, step),
      "+": () => map.jumpTo({ zoom: map.getZoom() + 0.5 }),
      "=": () => map.jumpTo({ zoom: map.getZoom() + 0.5 }),
      "-": () => map.jumpTo({ zoom: map.getZoom() - 0.5 }),
    };
    const handler = handlers[event.key];
    if (handler === undefined) return;
    event.preventDefault();
    handler();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || plan.kind === "loading" || plan.kind === "failed") return;
    if (!hasRenderableSize(container.clientWidth, container.clientHeight)) {
      onFail("map container has no renderable size");
      return;
    }
    let map: MapLibreMap | null = null;
    let registeredProtocol = false;
    try {
      if (window.location.hash === GLOBE_SPIKE_FAIL_HASH) {
        throw new GlobeSpikeError("forced spike failure");
      }
      setWorkerUrl(new URL(workerUrl, document.baseURI).href);
      if (plan.kind === "baked") {
        addProtocol(BAKED_PROTOCOL, createBakedTileLoader(plan.tiles.pack, plan.tiles.diagnostics));
        registeredProtocol = true;
      }
      setNotice(
        plan.kind === "runtime" && plan.reason !== null
          ? `Offline tile pack unavailable (${plan.reason}). Using runtime coastline tiling.`
          : null,
      );
      map = new MapLibreMap({
        container,
        style: buildStyle(plan),
        center: [10, 30],
        zoom: 1.4,
        maxZoom: 22,
        fadeDuration: 0,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
    } catch (error) {
      if (registeredProtocol) removeProtocol(BAKED_PROTOCOL);
      onFail(error instanceof Error ? error.message : String(error));
      return;
    }
    const active = map;
    mapRef.current = active;
    let idle = false;
    const mapErrors: string[] = [];
    active.on("idle", () => {
      idle = true;
      const zoom = active.getZoom();
      const limited =
        plan.kind === "baked" && zoom > plan.tiles.manifest.zoom.fitForPurposeMax
          ? ` coast detail limited to z${plan.tiles.manifest.zoom.fitForPurposeMax}`
          : "";
      setStatusText(`idle z=${formatFixed(zoom, { locale: "en-US", digits: 2 })}${limited}`);
    });
    active.on("movestart", () => {
      idle = false;
    });
    active.on("move", refreshIndicator);
    active.on("error", (event) => {
      const message = event.error?.message ?? "unknown";
      mapErrors.push(message);
      setStatusText(`error ${message}`);
      if (plan.kind === "baked" && plan.tiles.diagnostics.failures.length > 0) {
        setNotice(
          `${plan.tiles.diagnostics.failures.length} coastline tiles failed integrity checks.`,
        );
      }
    });

    const markerEntry = (id: string) => SPIKE_MARKERS.find((candidate) => candidate.id === id);
    const markerHit = (id: string): boolean => {
      const entry = markerEntry(id);
      if (entry === undefined) return false;
      const point = active.project(new LngLat(entry.lon, entry.lat));
      return active
        .queryRenderedFeatures(
          [
            [point.x - 4, point.y - 4],
            [point.x + 4, point.y + 4],
          ],
          { layers: ["markers"] },
        )
        .some((feature) => feature.properties?.id === id);
    };
    const waitIdle = (): Promise<void> =>
      new Promise((resolve) => {
        const check = () => {
          if (active.loaded() && !active.isMoving()) resolve();
          else active.once("idle", () => resolve());
        };
        requestAnimationFrame(() => requestAnimationFrame(check));
      });
    const correctAnchor = (anchorLngLat: LngLat, x: number, y: number): number => {
      const width = active.getContainer().clientWidth;
      const height = active.getContainer().clientHeight;
      for (let pass = 0; pass < 8; pass++) {
        const now = active.project(anchorLngLat);
        if (Math.hypot(now.x - x, now.y - y) < 0.01) break;
        active.jumpTo({
          center: active.unproject([width / 2 + (now.x - x), height / 2 + (now.y - y)]),
        });
      }
      const final = active.project(anchorLngLat);
      return Math.hypot(final.x - x, final.y - y);
    };
    const applyIntent = (intent: SpikeIntent): number => {
      if (intent.type === "setView") {
        active.jumpTo({
          center: [intent.lon, intent.lat],
          zoom: intent.zoom,
          bearing: intent.bearing ?? active.getBearing(),
          pitch: intent.pitch ?? active.getPitch(),
        });
        return 0;
      }
      if (intent.type === "panBy") {
        const centre = active.project(active.getCenter());
        active.jumpTo({ center: active.unproject([centre.x - intent.dx, centre.y - intent.dy]) });
        return 0;
      }
      const anchor = active.unproject([intent.x, intent.y]);
      active.easeTo({
        zoom: Math.max(0.8, Math.min(22, active.getZoom() + intent.levels)),
        around: anchor,
        duration: 0,
        animate: false,
      });
      return correctAnchor(anchor, intent.x, intent.y);
    };

    window.__globeSpike = {
      jumpTo: (lon, lat, zoom) => active.jumpTo({ center: [lon, lat], zoom }),
      setView: (view) =>
        active.jumpTo({
          center: [view.lon, view.lat],
          zoom: view.zoom,
          bearing: view.bearing ?? 0,
          pitch: view.pitch ?? 0,
        }),
      status: () => {
        const centre = active.getCenter();
        return {
          zoom: active.getZoom(),
          centre: [centre.lng, centre.lat] as const,
          globeness: readGlobeness(active),
          idle: idle && active.loaded(),
          land: landStatus(plan, active.getZoom()),
        };
      },
      samplePixels: (points) => {
        const source = active.getCanvas();
        const scale = source.width / active.getContainer().clientWidth;
        const copy = document.createElement("canvas");
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext("2d", { willReadFrequently: true });
        if (context === null) return [];
        context.drawImage(source, 0, 0);
        return points.map(([x, y]) => {
          const { data } = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1);
          return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as const;
        });
      },
      bakedDiagnostics: () => (plan.kind === "baked" ? plan.tiles.diagnostics : null),
      markerRenderedPixels: async (id) => {
        active.setFilter("markers", ["==", ["get", "id"], id]);
        for (let frame = 0; frame < 2; frame++) {
          await new Promise<void>((resolve) => {
            active.once("render", () => resolve());
            active.triggerRepaint();
          });
        }
        await nextFrame();
        const source = active.getCanvas();
        const copy = document.createElement("canvas");
        copy.width = Math.max(1, Math.floor(source.width / 4));
        copy.height = Math.max(1, Math.floor(source.height / 4));
        const context = copy.getContext("2d", { willReadFrequently: true });
        let count = 0;
        if (context !== null) {
          context.drawImage(source, 0, 0, copy.width, copy.height);
          const { data } = context.getImageData(0, 0, copy.width, copy.height);
          for (let index = 0; index < data.length; index += 4) {
            if (
              (data[index] ?? 0) > 200 &&
              (data[index + 1] ?? 0) > 170 &&
              (data[index + 2] ?? 0) < 140
            ) {
              count++;
            }
          }
        }
        active.setFilter("markers", null);
        return count;
      },
      project: (id) => {
        const entry = markerEntry(id);
        if (entry === undefined) return null;
        const point = active.project(new LngLat(entry.lon, entry.lat));
        return [point.x, point.y] as const;
      },
      projectLonLat: (lon, lat) => {
        const point = active.project(new LngLat(lon, lat));
        return [point.x, point.y] as const;
      },
      unproject: (x, y) => {
        const point = active.unproject([x, y]);
        return [point.lng, point.lat] as const;
      },
      hitMarker: markerHit,
      visibleMarkerIds: () => {
        const ids = new Set<string>();
        for (const feature of active.queryRenderedFeatures({ layers: ["markers"] })) {
          const id = feature.properties?.id;
          if (typeof id === "string") ids.add(id);
        }
        return [...ids].sort();
      },
      horizonPrediction: () => {
        const centre = active.getCenter();
        const camera: GlobeCamera = {
          centre: [centre.lng, centre.lat],
          zoom: active.getZoom(),
          pitchDegrees: active.getPitch(),
          bearingDegrees: active.getBearing(),
          viewportHeightPx: active.getContainer().clientHeight,
        };
        const rendered = new Set<string>();
        for (const feature of active.queryRenderedFeatures({ layers: ["markers"] })) {
          const id = feature.properties?.id;
          if (typeof id === "string") rendered.add(id);
        }
        return SPIKE_MARKERS.map((entry) => {
          const marginRadians = horizonMarginRadians(camera, [entry.lon, entry.lat]);
          return {
            id: entry.id,
            beyondHorizon: classifyHorizon(camera, [entry.lon, entry.lat]) === "back",
            horizonClass: classifyHorizon(camera, [entry.lon, entry.lat]),
            marginDegrees: marginRadians * (180 / Math.PI),
            visible: markerHit(entry.id),
            renderedAnywhere: rendered.has(entry.id),
          };
        });
      },
      pickAreas: (x, y) => {
        const hits: MapGeoJSONFeature[] = active.queryRenderedFeatures([x, y], {
          layers: ["areas-fill"],
        });
        return [...new Set(hits.map((feature) => String(feature.properties?.id)))].sort();
      },
      truthAreas: (lon, lat) => truthAreaIds(lon, lat),
      areaIds: () => areaIds(),
      areaLabel: (id) => areaLabelPoint(id),
      runProbes: async (points) => {
        const source = active.getSource("probe");
        if (source === undefined || !("setData" in source)) {
          return {
            requested: points.length,
            missing: points.length,
            maxErrorPx: null,
            meanErrorPx: null,
          };
        }
        (source as { setData: (data: unknown) => void }).setData({
          type: "FeatureCollection",
          features: points.map((point, index) => ({
            type: "Feature",
            properties: { index },
            geometry: { type: "Point", coordinates: [point[0], point[1]] },
          })),
        });
        await waitIdle();
        await nextFrame();
        await waitIdle();
        const canvas = active.getCanvas();
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext("2d", { willReadFrequently: true });
        if (context === null) {
          return {
            requested: points.length,
            missing: points.length,
            maxErrorPx: null,
            meanErrorPx: null,
          };
        }
        context.drawImage(canvas, 0, 0);
        const scale = canvas.width / canvas.clientWidth;
        const errors: number[] = [];
        let missing = 0;
        for (const point of points) {
          const expected = active.project(new LngLat(point[0], point[1]));
          const found = centroid(
            context,
            canvas.width,
            canvas.height,
            expected.x * scale,
            expected.y * scale,
            12 * scale,
          );
          if (found === null) {
            missing++;
            continue;
          }
          errors.push(Math.hypot(found[0] / scale - expected.x, found[1] / scale - expected.y));
        }
        (source as { setData: (data: unknown) => void }).setData(EMPTY);
        return {
          requested: points.length,
          missing,
          maxErrorPx: errors.length > 0 ? Math.max(...errors) : null,
          meanErrorPx: errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
        };
      },
      applyIntent,
      replay: (trace) => {
        let worst = 0;
        for (const intent of trace) worst = Math.max(worst, applyIntent(intent));
        const centre = active.getCenter();
        return {
          zoom: active.getZoom(),
          centre: [centre.lng, centre.lat] as const,
          bearing: active.getBearing(),
          pitch: active.getPitch(),
          maxAnchorDriftPx: worst,
        };
      },
      select,
      selected: () => selectedRef.current,
      selectedIndicator: () => {
        const id = selectedRef.current;
        const entry = id === null ? undefined : markerEntry(id);
        if (entry === undefined || id === null) return null;
        const point = active.project(new LngLat(entry.lon, entry.lat));
        return { visible: markerHit(id), x: point.x, y: point.y };
      },
      canvasPaintedPixels: () => {
        const source = active.getCanvas();
        const probe = document.createElement("canvas");
        probe.width = Math.min(64, source.width);
        probe.height = Math.min(64, source.height);
        const context = probe.getContext("2d", { willReadFrequently: true });
        if (context === null) return -1;
        context.drawImage(source, 0, 0, probe.width, probe.height);
        const { data } = context.getImageData(0, 0, probe.width, probe.height);
        let painted = 0;
        for (let index = 0; index < data.length; index += 4) {
          if ((data[index + 3] ?? 0) > 0 && (data[index] ?? 0) + (data[index + 1] ?? 0) > 0) {
            painted++;
          }
        }
        return painted;
      },
      errors: () => mapErrors,
      labelsRendered: () => active.queryRenderedFeatures({ layers: ["marker-labels"] }).length,
      whenIdle: waitIdle,
      liveMessage: () =>
        document.querySelector("[data-testid='globe-spike-live']")?.textContent ?? "",
    };
    return () => {
      delete window.__globeSpike;
      mapRef.current = null;
      active.remove();
      if (registeredProtocol) removeProtocol(BAKED_PROTOCOL);
    };
  }, [plan, onFail, refreshIndicator, select]);

  const selectedName = SPIKE_MARKERS.find((candidate) => candidate.id === selectedId)?.name ?? "";

  return (
    <div className="fixed inset-0 z-[9999] bg-black" data-testid="globe-spike">
      <div
        ref={containerRef}
        role="application"
        aria-label="Strategic world map, experimental globe. Use arrow keys to pan and plus or minus to zoom. A list of map entities is available."
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute inset-0"
        style={MAP_CONTAINER_STYLE}
      />
      <div className="absolute left-2 top-2 rounded bg-black/70 p-2 font-mono text-xs text-white">
        <span data-testid="globe-spike-status">{statusText}</span>
      </div>
      {notice === null ? null : (
        <div
          role="alert"
          data-testid="globe-spike-notice"
          className="absolute bottom-2 left-2 rounded bg-amber-700 p-2 text-xs text-white"
        >
          {notice}
        </div>
      )}
      <MapEntityList entities={list} selectedId={selectedId} onSelect={select} />
      <div aria-live="polite" role="status" data-testid="globe-spike-live" className="sr-only">
        {liveMessage}
      </div>
      {indicator === null || selectedId === null ? null : (
        <button
          type="button"
          data-testid="globe-spike-indicator"
          aria-label={`${selectedName} is off screen at bearing ${Math.round(indicator.bearing)} degrees. Activate to centre it.`}
          style={{ left: indicator.x - 14, top: indicator.y - 14 }}
          className="absolute h-7 w-7 rounded-full border-2 border-white bg-black text-white"
          onClick={() => select(selectedId)}
        >
          {"•"}
        </button>
      )}
    </div>
  );
}
