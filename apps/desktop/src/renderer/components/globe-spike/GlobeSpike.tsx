import {
  LngLat,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatFixed } from "../../lib/presentation-format/index.js";
import { useCoastline } from "../world-map/useCoastline.js";
import { GlobeSpikeError } from "./globe-spike-errors.js";
import { GLOBE_SPIKE_FAIL_HASH } from "./globe-spike-flag.js";
import {
  SPIKE_MARKERS,
  coastlineCollection,
  markerCollection,
  routeCollection,
  type GeoFeatureCollection,
} from "./globe-spike-scene.js";

export interface GlobeSpikeApi {
  readonly jumpTo: (lon: number, lat: number, zoom: number) => void;
  readonly status: () => {
    readonly zoom: number;
    readonly centre: readonly [number, number];
    readonly globeness: number | null;
    readonly idle: boolean;
  };
  readonly project: (id: string) => readonly [number, number] | null;
  readonly hitMarker: (id: string) => boolean;
  readonly canvasPaintedPixels: () => number;
  readonly errors: () => readonly string[];
  readonly labelsRendered: () => number;
}

declare global {
  interface Window {
    __globeSpike?: GlobeSpikeApi;
  }
}

export interface GlobeSpikeProps {
  readonly onFail: (reason: string) => void;
}

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

function buildStyle(coast: GeoFeatureCollection): StyleSpecification {
  return {
    version: 8,
    glyphs: `${baseDirectory()}map-spike/glyphs/{fontstack}/{range}.pbf`,
    projection: { type: "globe" },
    sources: {
      land: { type: "geojson", data: coast as never, maxzoom: 10, tolerance: 0.2 },
      markers: { type: "geojson", data: markerCollection() as never },
      routes: { type: "geojson", data: routeCollection() as never },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#0b2a3f" } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": "#33473b" } },
      {
        id: "land-line",
        type: "line",
        source: "land",
        paint: { "line-color": "#9cc2ae", "line-width": 0.8 },
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
    ],
  };
}

export function GlobeSpike({ onFail }: GlobeSpikeProps) {
  const coastline = useCoastline();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [statusText, setStatusText] = useState("starting");
  const coast = useMemo(
    () => (coastline.status === "ready" ? coastlineCollection(coastline.polygons) : null),
    [coastline],
  );

  useEffect(() => {
    if (coastline.status === "error") onFail(coastline.message);
  }, [coastline, onFail]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || coast === null) return;
    let map: MapLibreMap | null = null;
    let marker: Marker | null = null;
    try {
      if (window.location.hash === GLOBE_SPIKE_FAIL_HASH)
        throw new GlobeSpikeError("forced spike failure");
      setWorkerUrl(new URL(workerUrl, document.baseURI).href);
      map = new MapLibreMap({
        container,
        style: buildStyle(coast),
        center: [10, 30],
        zoom: 1.4,
        maxZoom: 22,
        fadeDuration: 0,
        attributionControl: false,
      });
    } catch (error) {
      onFail(error instanceof Error ? error.message : String(error));
      return;
    }
    const active = map;
    const element = document.createElement("div");
    element.style.cssText =
      "width:14px;height:14px;border:2px solid #000;border-radius:50%;background:#fff";
    const malta = SPIKE_MARKERS.find((entry) => entry.id === "spike-malta");
    if (malta !== undefined) {
      marker = new Marker({ element }).setLngLat([malta.lon, malta.lat]).addTo(active);
    }
    let idle = false;
    const mapErrors: string[] = [];
    active.on("idle", () => {
      idle = true;
      setStatusText(`idle z=${formatFixed(active.getZoom(), { locale: "en-US", digits: 2 })}`);
    });
    active.on("movestart", () => {
      idle = false;
    });
    active.on("error", (event) => {
      const message = event.error?.message ?? "unknown";
      mapErrors.push(message);
      setStatusText(`error ${message}`);
    });
    window.__globeSpike = {
      jumpTo: (lon, lat, zoom) => active.jumpTo({ center: [lon, lat], zoom }),
      status: () => {
        const centre = active.getCenter();
        return {
          zoom: active.getZoom(),
          centre: [centre.lng, centre.lat] as const,
          globeness: readGlobeness(active),
          idle: idle && active.loaded(),
        };
      },
      project: (id) => {
        const entry = SPIKE_MARKERS.find((candidate) => candidate.id === id);
        if (entry === undefined) return null;
        const point = active.project(new LngLat(entry.lon, entry.lat));
        return [point.x, point.y] as const;
      },
      hitMarker: (id) => {
        const entry = SPIKE_MARKERS.find((candidate) => candidate.id === id);
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
      },
      errors: () => mapErrors,
      labelsRendered: () => active.queryRenderedFeatures({ layers: ["marker-labels"] }).length,
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
          if ((data[index + 3] ?? 0) > 0 && (data[index] ?? 0) + (data[index + 1] ?? 0) > 0)
            painted++;
        }
        return painted;
      },
    };
    return () => {
      delete window.__globeSpike;
      marker?.remove();
      active.remove();
    };
  }, [coast, onFail]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black" data-testid="globe-spike">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-2 top-2 rounded bg-black/70 p-2 font-mono text-xs text-white">
        <span data-testid="globe-spike-status">{statusText}</span>
      </div>
    </div>
  );
}
