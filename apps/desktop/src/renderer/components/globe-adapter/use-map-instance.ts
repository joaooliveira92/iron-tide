import { Map as MapLibreMap, removeProtocol, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { formatFixed } from "../../lib/presentation-format/format.js";
import { BAKED_PROTOCOL } from "../globe-spike/baked-tiles.js";
import { hasRenderableSize } from "../globe-spike/map-container.js";
import type { LandPlan } from "../globe-spike/use-land-plan.js";
import type { MapPrototypeState } from "../world-map/map-state.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import { createAdapterBridge } from "./adapter-bridge.js";
import type { deriveAdapterModel } from "./adapter-derivations.js";
import {
  fromRendererCamera,
  type AppCameraState,
  type CameraProjection,
} from "./camera-contract.js";
import { DisposalRegistry } from "./disposal.js";
import { FLEET_GLYPH_ID, buildFleetGlyph } from "./fleet-glyph.js";
import { adapterFailureRequested, type AdapterLandMode } from "./globe-adapter-flag.js";
import { attachMapPointer, mapHealth } from "./map-pointer.js";
import { buildStyle, markerCollection, routeCollection } from "./map-style.js";
import { OverlayStore } from "./overlay-store.js";
import {
  NATURAL_EARTH_HIERARCHY,
  TileCache,
  hierarchyForManifest,
  selectTiles,
  type TileHierarchy,
} from "./tile-hierarchy.js";
import { registerBakedProtocol } from "./tile-protocol.js";
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
    try {
      setWorkerUrl(new URL(workerUrl, document.baseURI).href);
      registerBakedProtocol({ tiles: plan.tiles, hierarchy, cache, errors });
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
    const onImageMissing = (event: { readonly id: string }) => {
      if (event.id !== FLEET_GLYPH_ID || active.hasImage(FLEET_GLYPH_ID)) return;
      active.addImage(FLEET_GLYPH_ID, buildFleetGlyph(), { sdf: true });
    };
    active.on("styleimagemissing", onImageMissing);
    active.on("idle", onIdle);
    active.on("error", onError);
    disposal.add(attachMapPointer({ active, store, refs, sinks, onSelect, onRuler }));
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
