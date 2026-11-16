import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { MAP_CONTAINER_STYLE } from "../globe-spike/map-container.js";
import { useLandPlan } from "../globe-spike/use-land-plan.js";
import { MAP_VARIANT_LAYOUT } from "../world-map/map-variant-layout.js";
import { homeFocusPoint } from "../world-map/campaign-map-join.js";
import { nationFocusPoint } from "../world-map/useInitialFocusArea.js";
import { adapterLandMode, type AdapterLandMode } from "./globe-adapter-flag.js";
import { fitWorldCamera, type AppCameraState, type CameraProjection } from "./camera-contract.js";
import { GLOBE_ASSET_ROOT } from "./map-style.js";
import { OverlayStore } from "./overlay-store.js";
import { adapterProjectionFromApp, appProjectionFromAdapter } from "./adapter-layer-state.js";
import { deriveAdapterModel } from "./adapter-derivations.js";
import { GlobeAdapterChrome } from "./GlobeAdapterChrome.js";
import { GlobeAdapterStatusStrip } from "./GlobeAdapterStatusStrip.js";
import { GlobeAdapterScreenReader } from "./GlobeAdapterScreenReader.js";
import { useAdapterFailureRequested } from "./use-failure-request.js";
import { useCameraSync } from "./use-camera-sync.js";
import { useHoverTooltip } from "./use-hover-tooltip.js";
import { useLayerSet } from "./use-layer-set.js";
import { useMapInstance } from "./use-map-instance.js";
import { fleetIdFromMarker, routeAnnouncement } from "./adapter-interaction.js";
import { buildEntityRows } from "./entity-rows.js";
import { useMapActions } from "./use-map-actions.js";
import { useMapKeyboard } from "./use-map-keyboard.js";
import { useOverlayProjection } from "./use-overlay-projection.js";
import { TileCache } from "./tile-cache.js";
import { NATURAL_EARTH_HIERARCHY, type TileHierarchy } from "./tile-hierarchy.js";

export { GLOBE_ASSET_ROOT };
export type { GlobeAdapterProps, AdapterDiagnostics } from "./globe-adapter-types.js";
import type { GlobeAdapterProps } from "./globe-adapter-types.js";

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
  landMode,
  variant = "full",
  showMinimap = true,
  initialFocusAreaId = null,
  initialFocusNationId = null,
  camera: sharedCamera = null,
  onCameraChange,
}: GlobeAdapterProps) {
  const restoringCameraRef = useRef(sharedCamera !== null);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const hash = window.location.hash;
  const mode: AdapterLandMode = landMode ?? adapterLandMode(hash);
  const plan = useLandPlan(mode, GLOBE_ASSET_ROOT);
  const failureRequested = useAdapterFailureRequested();
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
  const [camera, setCamera] = useState<AppCameraState>(() => {
    const adapterProjection = adapterProjectionFromApp(state.projection);
    return sharedCamera === null
      ? fitWorldCamera(adapterProjection)
      : { ...sharedCamera, projection: adapterProjection };
  });
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const { hoverText, placeHoverTooltip, setHoverTooltip } = useHoverTooltip();
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

  const entityRows = useMemo(() => buildEntityRows(overlay), [overlay.fleets, overlay.ports]);

  useOverlayProjection({ mapRef, storeRef, ready, overlay, state, route, orders });

  useLayerSet({
    mapRef,
    ready,
    variant,
    layers: state.layers,
    ownership: overlay.ownership,
    selected: state.selected,
    selectedAreaRef,
    hoveredArea,
    selectedFleet,
  });

  useEffect(() => {
    setLiveMessage(routeAnnouncement(route));
  }, [route]);

  useCameraSync({
    mapRef,
    projectionRef,
    restoringRef: restoringCameraRef,
    ready,
    appProjection: state.projection,
    centre: state.centre,
    initialFocusAreaId,
    initialFocusNationId,
    setProjection,
  });

  useMapInstance({
    refs: {
      container: containerRef,
      map: mapRef,
      store: storeRef,
      cache: cacheRef,
      abort: abortRef,
      projection: projectionRef,
      hoverFrame: hoverFrameRef,
      hovered: hoveredRef,
      hoveredArea: hoveredAreaRef,
      drag: dragRef,
      onCameraChange: onCameraChangeRef,
      orders: ordersRef,
      derived: derivedRef,
      initialOverlay: initialOverlayRef,
      initialLayers: initialLayersRef,
    },
    sinks: {
      setReady,
      setStatus,
      setCamera,
      setErrorText,
      setLiveMessage,
      setSelectedFleet,
      setHoveredArea,
      setHoverTooltip,
      setProjection,
    },
    plan,
    mode,
    variant,
    initialCamera,
    failureRequested,
    onUnavailable,
    onSelect,
    onRuler,
  });

  const { resetView, handleSetProjection, recentre } = useMapActions({
    mapRef,
    projectionRef,
    centre: state.centre,
    setProjection,
    onSetProjection,
    onSetCentre,
  });

  const onKeyDown = useMapKeyboard({
    mapRef,
    orders,
    onSelect,
    onResetView: resetView,
    setSelectedFleet,
    setLiveMessage,
  });

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
      <GlobeAdapterStatusStrip
        label={statusLabel}
        projection={projection}
        onToggleProjection={() =>
          handleSetProjection(
            appProjectionFromAdapter(projection === "globe" ? "mercator" : "globe"),
          )
        }
        onNorth={() => mapRef.current?.setBearing(0)}
      />
      {hoverText === null ? null : (
        <div
          ref={placeHoverTooltip}
          role="tooltip"
          data-testid="globe-adapter-tooltip"
          className="pointer-events-none absolute z-30 max-w-64 rounded bg-black/85 px-2 py-1 text-xs text-white"
        >
          {hoverText}
        </div>
      )}
      <GlobeAdapterChrome
        state={state}
        route={route}
        viewport={viewport}
        variant={variant}
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
      <GlobeAdapterScreenReader
        liveMessage={liveMessage}
        entityRows={entityRows}
        camera={camera}
        hierarchy={hierarchy}
      />
    </div>
  );
}
