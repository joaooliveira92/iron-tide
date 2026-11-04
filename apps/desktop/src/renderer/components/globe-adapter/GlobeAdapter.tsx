import {
  Map as MapLibreMap,
  addProtocol,
  removeProtocol,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AREAS_BY_ID } from "../world-map/map-geometry.js";
import { formatFixed } from "../../lib/presentation-format/format.js";
import { BAKED_PROTOCOL, createBakedTileLoader } from "../globe-spike/baked-tiles.js";
import { MAP_CONTAINER_STYLE, hasRenderableSize } from "../globe-spike/map-container.js";
import { useLandPlan } from "../globe-spike/use-land-plan.js";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";
import { MAP_VARIANT_LAYOUT } from "../world-map/map-variant-layout.js";
import { homeFocusPoint } from "../world-map/campaign-map-join.js";
import { nationFocusPoint } from "../world-map/useInitialFocusArea.js";
import {
  adapterFailureRequested,
  adapterLandMode,
  type AdapterLandMode,
} from "./globe-adapter-flag.js";
import {
  fitWorldCamera,
  fromRendererCamera,
  type AppCameraState,
  type CameraProjection,
} from "./camera-contract.js";
import { DisposalRegistry } from "./disposal.js";
import { FLEET_GLYPH_ID, buildFleetGlyph } from "./fleet-glyph.js";
import { projectOverlay } from "./overlay-projection.js";
import { OverlayStore } from "./overlay-store.js";
import {
  adapterLayerVisibility,
  adapterProjectionFromApp,
  appProjectionFromAdapter,
  fleetGlyphFilter,
  markerFilter,
  ownershipPaintValues,
} from "./adapter-layer-state.js";
import { deriveAdapterModel } from "./adapter-derivations.js";
import { GlobeAdapterChrome } from "./GlobeAdapterChrome.js";
import { fleetIdFromMarker, routeAnnouncement } from "./adapter-interaction.js";
import {
  NATURAL_EARTH_HIERARCHY,
  TileCache,
  hierarchyForManifest,
  selectTiles,
  tileCacheKey,
  type TileHierarchy,
} from "./tile-hierarchy.js";

import { GLOBE_ASSET_ROOT, type GlobeAdapterProps } from "./globe-adapter-types.js";
import { mapHealth } from "./map-camera.js";
import { createMapInteractions } from "./map-interactions.js";
import {
  GlobeDiagnosticsMirror,
  GlobeEntityTable,
  GlobeHoverTooltip,
  GlobeLiveRegion,
  GlobeStatusBar,
} from "./GlobeAdapterParts.js";
import { installDebugBridge } from "./debug-bridge.js";
import { buildStyle } from "./map-style.js";
import { markerCollection, routeCollection } from "./map-sources.js";

export { GLOBE_ASSET_ROOT };
export type { AdapterDiagnostics, GlobeAdapterProps } from "./globe-adapter-types.js";

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
  camera: sharedCamera = null,
  onCameraChange,
}: GlobeAdapterProps) {
  const showAreas = variant !== "command";
  const restoringCameraRef = useRef(sharedCamera !== null);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
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
  const [ready, setReady] = useState(false);
  const [projection, setProjection] = useState<CameraProjection>(() =>
    adapterProjectionFromApp(state.projection),
  );
  const [status, setStatus] = useState("starting");
  const [liveMessage, setLiveMessage] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [camera, setCamera] = useState<AppCameraState>(() => {
    const adapterProjection = adapterProjectionFromApp(state.projection);
    return sharedCamera === null
      ? fitWorldCamera(adapterProjection)
      : { ...sharedCamera, projection: adapterProjection };
  });
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{
    readonly x: number;
    readonly y: number;
    readonly text: string;
  } | null>(null);
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null);
  const [initialCamera] = useState<AppCameraState>(() => {
    const point = homeFocusPoint(initialFocusAreaId);
    return point === null || restoringCameraRef.current
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
    if (map === null || !ready || restoringCameraRef.current) return;
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
      onCameraChangeRef.current?.(
        fromRendererCamera({
          centre: [active.getCenter().lng, active.getCenter().lat],
          zoom,
          bearing: active.getBearing(),
          pitch: active.getPitch(),
          projection: projectionRef.current,
        }),
      );
    };
    const onError = (event: { readonly error?: { readonly message?: string } }) => {
      const message = event.error?.message ?? "unknown";
      errors.push(message);
      setErrorText(message);
    };
    const interactions = createMapInteractions({
      active,
      store,
      projectionRef,
      ordersRef,
      derivedRef,
      onSelect,
      onRuler,
      setSelectedFleet,
      setLiveMessage,
      setHoveredArea,
      setHoverTooltip,
    });
    const {
      onClick,
      onMove,
      onMouseOut,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    } = interactions;
    const canvas = active.getCanvas();
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

    installDebugBridge({
      active,
      store,
      cache,
      hierarchy,
      errors,
      projectionRef,
      onSelect,
      setProjection,
    });

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
      interactions.dispose();
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
    if (map === null || !ready || restoringCameraRef.current) return;
    const point = homeFocusPoint(initialFocusAreaId);
    if (point === null) return;
    const target = nationFocusPoint(point, initialFocusNationId);
    map.jumpTo({ center: [target[0], target[1]], zoom: 3.5, bearing: 0, pitch: 0 });
  }, [initialFocusAreaId, initialFocusNationId, ready]);

  useEffect(() => {
    if (ready) restoringCameraRef.current = false;
  }, [ready]);

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
      <GlobeStatusBar
        statusLabel={statusLabel}
        projection={projection}
        onToggleProjection={() =>
          handleSetProjection(
            appProjectionFromAdapter(projection === "globe" ? "mercator" : "globe"),
          )
        }
        onNorth={() => mapRef.current?.setBearing(0)}
      />
      <GlobeHoverTooltip tooltip={hoverTooltip} />
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
      <GlobeLiveRegion message={liveMessage} />
      <GlobeEntityTable rows={entityRows} />
      <GlobeDiagnosticsMirror camera={camera} hierarchy={hierarchy} />
    </div>
  );
}
