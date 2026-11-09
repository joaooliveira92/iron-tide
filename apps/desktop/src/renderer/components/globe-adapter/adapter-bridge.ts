import type { Map as MapLibreMap } from "maplibre-gl";
import { AREAS, AREAS_BY_ID } from "../world-map/map-geometry.js";
import type { CameraProjection } from "./camera-contract.js";
import type { OverlayStore } from "./overlay-store.js";
import {
  TileCache,
  isOverscaled,
  selectTiles,
  sourceLevelForDisplay,
  type TileHierarchy,
} from "./tile-hierarchy.js";

export type AdapterBridge = NonNullable<Window["__globeAdapter"]>;

export interface AdapterBridgeInput {
  readonly map: MapLibreMap;
  readonly store: OverlayStore;
  readonly cache: TileCache;
  readonly hierarchy: TileHierarchy;
  readonly errors: readonly string[];
  readonly projection: () => CameraProjection;
  readonly setProjection: (next: CameraProjection) => void;
  readonly onSelect: (id: string | null) => void;
}

type BenchMarker = {
  readonly id: string;
  readonly kind: "marker";
  readonly order: number;
  readonly minZoom: number;
  readonly markerClass: "port";
  readonly label: string;
  readonly areaId: string;
  readonly geometry: { readonly type: "Point"; readonly lon: number; readonly lat: number };
};

function benchMarker(index: number, areaIndex: number): BenchMarker {
  const area = AREAS[areaIndex % AREAS.length] as (typeof AREAS)[number];
  return {
    id: `bench-marker-${index}`,
    kind: "marker",
    order: 10_000 + index,
    minZoom: 0,
    markerClass: "port",
    label: `Bench ${index}`,
    areaId: area.id,
    geometry: { type: "Point", lon: area.label[0], lat: area.label[1] },
  };
}

function clampCount(count: number): number {
  return Math.max(0, Math.min(5000, Math.floor(count)));
}

export function createAdapterBridge({
  map,
  store,
  cache,
  hierarchy,
  errors,
  projection,
  setProjection,
  onSelect,
}: AdapterBridgeInput): AdapterBridge {
  const selection = () =>
    selectTiles(
      {
        centre: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom(),
        pitchDegrees: map.getPitch(),
        bearingDegrees: map.getBearing(),
        viewport: {
          width: map.getContainer().clientWidth,
          height: map.getContainer().clientHeight,
        },
        dpr: window.devicePixelRatio,
        mode: projection(),
      },
      hierarchy,
    );
  const markerCount = () =>
    store.snapshot().features.filter((feature) => feature.kind === "marker").length;
  const screenPoint = (lon: number, lat: number) => {
    const point = map.project([lon, lat]);
    const rect = map.getCanvas().getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  };
  const waitIdle = (): Promise<void> =>
    new Promise((resolve) => {
      if (map.loaded() && !map.isMoving()) {
        requestAnimationFrame(() => resolve());
        return;
      }
      map.once("idle", () => resolve());
    });

  return {
    diagnostics: () => {
      const tiles = selection();
      const snapshot = store.snapshot();
      return {
        zoom: map.getZoom(),
        centre: [map.getCenter().lng, map.getCenter().lat],
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        projection: projection(),
        sourceLevel: sourceLevelForDisplay(map.getZoom(), hierarchy),
        overscaled: isOverscaled(map.getZoom(), hierarchy),
        visibleTiles: tiles.tiles.length,
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
      const total = clampCount(count);
      const changes = Array.from({ length: total }, (_, index) => {
        const feature = benchMarker(index, index);
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
        markerCount: markerCount(),
      };
    },
    benchmarkBatch: (count) => {
      const total = clampCount(count);
      const changes = Array.from({ length: total }, (_, index) => {
        const id = `bench-marker-${index}`;
        const current = store.snapshot().features.find((feature) => feature.id === id);
        const feature = current ?? benchMarker(index, index * 3);
        if (feature.geometry.type !== "Point") return null;
        const area = AREAS[(index * 3) % AREAS.length] as (typeof AREAS)[number];
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
      return screenPoint(feature.geometry.lon, feature.geometry.lat);
    },
    areaScreenPoint: (id) => {
      const area = AREAS_BY_ID.get(id);
      if (area === undefined) return null;
      return screenPoint(area.label[0], area.label[1]);
    },
    areaLabelsRendered: () => map.queryRenderedFeatures({ layers: ["area-labels-list"] }).length,
    jumpTo: (lon, lat, zoom) => map.jumpTo({ center: [lon, lat], zoom }),
    setProjection: (next) => {
      map.setProjection({ type: next });
      setProjection(next);
    },
    whenIdle: waitIdle,
  };
}
