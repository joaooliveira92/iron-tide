import { LngLat, Map as MapLibreMap, addProtocol, removeProtocol, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { formatFixed } from "../../lib/presentation-format/format.js";
import { BAKED_PROTOCOL, createBakedTileLoader } from "./baked-tiles.js";
import { createSpikeApi } from "./globe-spike-bridge.js";
import { entities } from "./globe-spike-entities.js";
import { GlobeSpikeError } from "./globe-spike-errors.js";
import { GLOBE_SPIKE_FAIL_HASH, landModeFromHash } from "./globe-spike-flag.js";
import { SPIKE_MARKERS } from "./globe-spike-scene.js";
import { buildStyle } from "./globe-spike-style.js";
import { edgeIndicator, initialBearingDegrees } from "./horizon.js";
import { MAP_CONTAINER_STYLE, hasRenderableSize } from "./map-container.js";
import { MapEntityList } from "./MapEntityList.js";
import { useLandPlan } from "./use-land-plan.js";

export interface GlobeSpikeProps {
  readonly onFail: (reason: string) => void;
}

export function GlobeSpike({ onFail }: GlobeSpikeProps) {
  const landMode = useMemo(() => landModeFromHash(window.location.hash), []);
  const plan = useLandPlan(landMode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [statusText, setStatusText] = useState("starting");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [indicatorBearing, setIndicatorBearing] = useState<number | null>(null);
  const indicatorRef = useRef<HTMLButtonElement | null>(null);
  const indicatorOriginRef = useRef<{ readonly x: number; readonly y: number } | null>(null);
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

  const placeIndicator = useCallback((element: HTMLButtonElement | null) => {
    indicatorRef.current = element;
    const origin = indicatorOriginRef.current;
    if (element === null || origin === null) return;
    element.style.left = `${origin.x - 14}px`;
    element.style.top = `${origin.y - 14}px`;
  }, []);

  const refreshIndicator = useCallback(() => {
    const map = mapRef.current;
    const id = selectedRef.current;
    if (map === null || id === null) {
      indicatorOriginRef.current = null;
      setIndicatorBearing(null);
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
      indicatorOriginRef.current = null;
      setIndicatorBearing(null);
      return;
    }
    const bearing = initialBearingDegrees([centre.lng, centre.lat], [entry.lon, entry.lat]);
    const placed = edgeIndicator(bearing, map.getBearing(), { width, height }, 28);
    indicatorOriginRef.current = { x: placed.x, y: placed.y };
    placeIndicator(indicatorRef.current);
    setIndicatorBearing(Math.round(bearing));
  }, [placeIndicator]);

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

    window.__globeSpike = createSpikeApi({
      active,
      plan,
      isIdle: () => idle,
      errors: mapErrors,
      select,
      selectedRef,
    });
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
      {indicatorBearing === null || selectedId === null ? null : (
        <button
          ref={placeIndicator}
          type="button"
          data-testid="globe-spike-indicator"
          aria-label={`${selectedName} is off screen at bearing ${indicatorBearing} degrees. Activate to centre it.`}
          className="absolute h-7 w-7 rounded-full border-2 border-white bg-black text-white"
          onClick={() => select(selectedId)}
        >
          {"•"}
        </button>
      )}
    </div>
  );
}
