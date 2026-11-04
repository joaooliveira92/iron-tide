import type { Map as MapLibreMap } from "maplibre-gl";

import { AREAS, AREAS_BY_ID } from "../world-map/map-geometry.js";
import type { CameraProjection } from "./camera-contract.js";
import type { OverlayStore } from "./overlay-store.js";
import {
  isOverscaled,
  selectTiles,
  sourceLevelForDisplay,
  type TileCache,
  type TileHierarchy,
} from "./tile-hierarchy.js";

export interface DebugBridgeInput {
  readonly active: MapLibreMap;
  readonly store: OverlayStore;
  readonly cache: TileCache;
  readonly hierarchy: TileHierarchy;
  readonly errors: readonly string[];
  readonly projectionRef: { current: CameraProjection };
  readonly onSelect: (id: string | null) => void;
  readonly setProjection: (projection: CameraProjection) => void;
}

export function installDebugBridge({
  active,
  store,
  cache,
  hierarchy,
  errors,
  projectionRef,
  onSelect,
  setProjection,
}: DebugBridgeInput): void {
  const waitIdle = (): Promise<void> =>
    new Promise((resolve) => {
      if (active.loaded() && !active.isMoving()) {
        requestAnimationFrame(() => resolve());
        return;
      }
      active.once("idle", () => resolve());
    });

  const bridge: NonNullable<Window["__globeAdapter"]> = {
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
    areaLabelsRendered: () => active.queryRenderedFeatures({ layers: ["area-labels-list"] }).length,
    jumpTo: (lon, lat, zoom) => active.jumpTo({ center: [lon, lat], zoom }),
    setProjection: (next) => {
      active.setProjection({ type: next });
      setProjection(next);
      projectionRef.current = next;
    },
    whenIdle: waitIdle,
  };
  window.__globeAdapter = bridge;
}
