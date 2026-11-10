import { LngLat, type Map as MapLibreMap, type MapGeoJSONFeature } from "maplibre-gl";

import { landStatus, type GlobeSpikeApi, type SpikeIntent } from "./globe-spike-api.js";
import { createProbeApi, waitForIdle } from "./globe-spike-probes.js";
import { SPIKE_MARKERS } from "./globe-spike-scene.js";
import { classifyHorizon, horizonMarginRadians, type GlobeCamera } from "./horizon.js";
import { areaIds, areaLabelPoint, truthAreaIds } from "./spike-areas.js";
import type { LandPlan } from "./use-land-plan.js";

function readGlobeness(map: MapLibreMap): number | null {
  const style: unknown = Reflect.get(map, "style");
  if (typeof style !== "object" || style === null) return null;
  const projection: unknown = Reflect.get(style, "projection");
  if (typeof projection !== "object" || projection === null) return null;
  const state: unknown = Reflect.get(projection, "transitionState");
  return typeof state === "number" ? state : null;
}

export interface SpikeBridgeInput {
  readonly active: MapLibreMap;
  readonly plan: LandPlan;
  readonly isIdle: () => boolean;
  readonly errors: readonly string[];
  readonly select: (id: string) => void;
  readonly selectedRef: { readonly current: string | null };
}

export function createSpikeApi({
  active,
  plan,
  isIdle,
  errors,
  select,
  selectedRef,
}: SpikeBridgeInput): GlobeSpikeApi {
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
  const waitIdle = () => waitForIdle(active);
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

  return {
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
        idle: isIdle() && active.loaded(),
        land: landStatus(plan, active.getZoom()),
      };
    },
    ...createProbeApi(active),
    bakedDiagnostics: () => (plan.kind === "baked" ? plan.tiles.diagnostics : null),
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
    errors: () => errors,
    labelsRendered: () => active.queryRenderedFeatures({ layers: ["marker-labels"] }).length,
    whenIdle: waitIdle,
    liveMessage: () =>
      document.querySelector("[data-testid='globe-spike-live']")?.textContent ?? "",
  };
}
