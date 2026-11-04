import {
  Map as MapLibreMap,
  addProtocol,
  removeProtocol,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { formatFixed } from "../../lib/presentation-format/format.js";
import { BAKED_PROTOCOL, createBakedTileLoader } from "../globe-spike/baked-tiles.js";
import { classifyHorizon, type GlobeCamera } from "../globe-spike/horizon.js";
import { hasRenderableSize } from "../globe-spike/map-container.js";
import type { LandPlan } from "../globe-spike/use-land-plan.js";
import type { MapPrototypeState } from "../world-map/map-state.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import { createAdapterBridge } from "./adapter-bridge.js";
import type { deriveAdapterModel } from "./adapter-derivations.js";
import {
  adapterDrop,
  dragThresholdMet,
  fleetIdFromMarker,
  isDraggableFleet,
} from "./adapter-interaction.js";
import {
  fromRendererCamera,
  type AppCameraState,
  type CameraProjection,
} from "./camera-contract.js";
import { DisposalRegistry } from "./disposal.js";
import { FLEET_GLYPH_ID, buildFleetGlyph } from "./fleet-glyph.js";
import { adapterFailureRequested, type AdapterLandMode } from "./globe-adapter-flag.js";
import { buildStyle, markerCollection, routeCollection } from "./map-style.js";
import { OverlayStore } from "./overlay-store.js";
import { selectPointerTarget } from "./pointer-visibility.js";
import {
  NATURAL_EARTH_HIERARCHY,
  TileCache,
  hierarchyForManifest,
  selectTiles,
  tileCacheKey,
  type TileHierarchy,
} from "./tile-hierarchy.js";
import type { GlobeAdapterProps } from "./GlobeAdapter.js";

export interface HoverTooltip {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface DragState {
  readonly fleetId: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  dragging: boolean;
}

type Ref<T> = MutableRefObject<T>;

export interface MapInstanceRefs {
  readonly container: Ref<HTMLDivElement | null>;
  readonly map: Ref<MapLibreMap | null>;
  readonly store: Ref<OverlayStore | null>;
  readonly cache: Ref<TileCache | null>;
  readonly abort: Ref<AbortController | null>;
  readonly projection: Ref<CameraProjection>;
  readonly hoverFrame: Ref<number | null>;
  readonly hovered: Ref<string | null>;
  readonly hoveredArea: Ref<string | null>;
  readonly drag: Ref<DragState | null>;
  readonly onCameraChange: Ref<GlobeAdapterProps["onCameraChange"]>;
  readonly orders: Ref<GlobeAdapterProps["orders"]>;
  readonly derived: Ref<ReturnType<typeof deriveAdapterModel>>;
  readonly initialOverlay: Ref<GlobeAdapterProps["overlay"]>;
  readonly initialLayers: Ref<MapPrototypeState["layers"]>;
}

export interface MapInstanceSinks {
  readonly setReady: Dispatch<SetStateAction<boolean>>;
  readonly setStatus: Dispatch<SetStateAction<string>>;
  readonly setCamera: Dispatch<SetStateAction<AppCameraState>>;
  readonly setErrorText: Dispatch<SetStateAction<string | null>>;
  readonly setLiveMessage: Dispatch<SetStateAction<string>>;
  readonly setSelectedFleet: Dispatch<SetStateAction<string | null>>;
  readonly setHoveredArea: Dispatch<SetStateAction<string | null>>;
  readonly setHoverTooltip: Dispatch<SetStateAction<HoverTooltip | null>>;
  readonly setProjection: Dispatch<SetStateAction<CameraProjection>>;
}

export interface MapInstanceInput {
  readonly refs: MapInstanceRefs;
  readonly sinks: MapInstanceSinks;
  readonly plan: LandPlan;
  readonly mode: AdapterLandMode;
  readonly variant: MapVariant;
  readonly initialCamera: AppCameraState;
  readonly forceFailure: boolean;
  readonly onUnavailable: (reason: string) => void;
  readonly onSelect: (area: string | null) => void;
  readonly onRuler: (area: string) => void;
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

export function useMapInstance({
  refs,
  sinks,
  plan,
  mode,
  variant,
  initialCamera,
  forceFailure,
  onUnavailable,
  onSelect,
  onRuler,
}: MapInstanceInput): void {
  useEffect(() => {
    const container = refs.container.current;
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
    refs.abort.current = abort;
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
    refs.cache.current = cache;
    const store = new OverlayStore({ disposeSignal: abort.signal });
    refs.store.current = store;
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
        style: buildStyle(plan, {
          ownership: refs.initialOverlay.current.ownership,
          layers: refs.initialLayers.current,
          variant,
        }),
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
    refs.map.current = active;
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
          mode: refs.projection.current,
        },
        hierarchy,
      );
      sinks.setStatus(
        `idle z=${formatFixed(zoom, { locale: "en-US", digits: 2 })} source z${selection.level}${selection.overscaled ? " overscaled" : ""} tiles=${selection.tiles.length}`,
      );
      sinks.setCamera((current) => ({
        ...current,
        centre: [active.getCenter().lng, active.getCenter().lat],
        zoom,
        bearing: active.getBearing(),
        pitch: active.getPitch(),
        projection: refs.projection.current,
      }));
      refs.onCameraChange.current?.(
        fromRendererCamera({
          centre: [active.getCenter().lng, active.getCenter().lat],
          zoom,
          bearing: active.getBearing(),
          pitch: active.getPitch(),
          projection: refs.projection.current,
        }),
      );
    };
    const onError = (event: { readonly error?: { readonly message?: string } }) => {
      const message = event.error?.message ?? "unknown";
      errors.push(message);
      sinks.setErrorText(message);
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
          horizon: horizonFor(active, lon, lat, refs.projection.current),
        };
      });
      const target = selectPointerTarget(candidates);
      if (target !== null) {
        const hit = hits.find((feature) => String(feature.properties?.id) === target);
        const areaId = String(hit?.properties?.areaId ?? "");
        const markerId = String(hit?.properties?.id ?? "");
        const fleetId = fleetIdFromMarker(markerId);
        if (!shiftKey && fleetId !== null) {
          refs.orders.current?.onSelectFleet(fleetId);
          sinks.setSelectedFleet(fleetId);
          sinks.setLiveMessage(`Selected fleet ${String(hit?.properties?.name ?? fleetId)}`);
          return;
        }
        if (areaId.length > 0) {
          if (shiftKey) onRuler(areaId);
          else onSelect(areaId);
          sinks.setLiveMessage(
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
        sinks.setLiveMessage(`Route via ${refs.derived.current.areaName(areaId)}`);
      } else {
        onSelect(areaId);
        sinks.setLiveMessage(`Selected ${refs.derived.current.describeAreaFor(areaId)}`);
      }
    };
    const onClick = (event: {
      readonly point: { readonly x: number; readonly y: number };
      readonly originalEvent: MouseEvent;
    }) => {
      pick(event.point.x, event.point.y, event.originalEvent.shiftKey);
    };
    const onMove = (event: { readonly point: { readonly x: number; readonly y: number } }) => {
      if (refs.hoverFrame.current !== null) cancelAnimationFrame(refs.hoverFrame.current);
      refs.hoverFrame.current = requestAnimationFrame(() => {
        const markerHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
          layers: ["adapter-markers"],
        });
        const markerId =
          markerHits.length === 0 ? null : String(markerHits[0]?.properties?.id ?? "");
        if (markerId !== refs.hovered.current) {
          refs.hovered.current = markerId;
          store.setHovered(markerId);
        }
        const areaHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
          layers: ["areas-fill"],
        });
        const areaId = areaHits.length === 0 ? null : String(areaHits[0]?.properties?.id ?? "");
        if (areaId !== refs.hoveredArea.current) {
          refs.hoveredArea.current = areaId;
          sinks.setHoveredArea(areaId);
        }
        if (areaId === null) {
          sinks.setHoverTooltip(null);
        } else {
          sinks.setHoverTooltip({
            x: event.point.x,
            y: event.point.y,
            text: refs.derived.current.describeAreaFor(areaId),
          });
        }
        active.getCanvas().style.cursor =
          markerId === null ? (areaId === null ? "" : "crosshair") : "pointer";
      });
    };
    const onMouseOut = () => {
      refs.hovered.current = null;
      refs.hoveredArea.current = null;
      store.setHovered(null);
      sinks.setHoveredArea(null);
      sinks.setHoverTooltip(null);
    };
    const canvas = active.getCanvas();
    const pointOf = (event: PointerEvent): { readonly x: number; readonly y: number } => {
      const box = canvas.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const onPointerDown = (event: PointerEvent) => {
      const currentOrders = refs.orders.current;
      if (currentOrders === undefined || event.button !== 0) return;
      const at = pointOf(event);
      const hits = active.queryRenderedFeatures([at.x, at.y], { layers: ["adapter-markers"] });
      const markerId = hits.length === 0 ? null : String(hits[0]?.properties?.id ?? "");
      const fleetId = fleetIdFromMarker(markerId);
      if (!isDraggableFleet(currentOrders, fleetId) || fleetId === null) return;
      active.dragPan.disable();
      canvas.setPointerCapture?.(event.pointerId);
      refs.drag.current = {
        fleetId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      currentOrders.onSelectFleet(fleetId);
      sinks.setSelectedFleet(fleetId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const drag = refs.drag.current;
      if (drag === null || drag.pointerId !== event.pointerId || drag.dragging) return;
      if (
        dragThresholdMet({ x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY })
      ) {
        drag.dragging = true;
        canvas.style.cursor = "grabbing";
      }
    };
    const endDrag = (event: PointerEvent, drop: boolean) => {
      const drag = refs.drag.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      active.dragPan.enable();
      canvas.style.cursor = "";
      refs.drag.current = null;
      if (!drop || !drag.dragging) return;
      const at = pointOf(event);
      const areas = active.queryRenderedFeatures([at.x, at.y], { layers: ["areas-fill"] });
      const areaId = areas.length === 0 ? null : String(areas[0]?.properties?.id ?? "");
      const currentOrders = refs.orders.current;
      const resolution = adapterDrop(currentOrders, drag.fleetId, areaId);
      if (resolution.kind === "ignored") {
        sinks.setLiveMessage("That fleet destination is not available.");
        return;
      }
      currentOrders?.onDrop(drag.fleetId, areaId as string);
      sinks.setLiveMessage(
        `Ordered fleet to ${areaId === null ? "an area" : refs.derived.current.areaName(areaId)}`,
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
      sinks.setReady(true);
      onIdle();
    });

    window.__globeAdapter = createAdapterBridge({
      map: active,
      store,
      cache,
      hierarchy,
      errors,
      projection: () => refs.projection.current,
      setProjection: (next) => {
        sinks.setProjection(next);
        refs.projection.current = next;
      },
      onSelect,
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
      if (refs.hoverFrame.current !== null) cancelAnimationFrame(refs.hoverFrame.current);
    });
    disposal.add(() => active.remove());
    disposal.add(() => {
      if (registeredProtocol) removeProtocol(BAKED_PROTOCOL);
    });
    disposal.add(() => {
      delete window.__globeAdapter;
      sinks.setReady(false);
      refs.map.current = null;
      refs.store.current = null;
      refs.cache.current = null;
    });

    return () => disposal.dispose();
  }, [forceFailure, mode, onRuler, onSelect, onUnavailable, plan]);
}
