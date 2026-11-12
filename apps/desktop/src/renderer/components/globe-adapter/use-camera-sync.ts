import { useEffect, type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";
import { homeFocusPoint } from "../world-map/campaign-map-join.js";
import { nationFocusPoint } from "../world-map/useInitialFocusArea.js";
import { adapterProjectionFromApp } from "./adapter-layer-state.js";
import type { CameraProjection } from "./camera-contract.js";

export interface CameraSyncInput {
  readonly mapRef: MutableRefObject<MapLibreMap | null>;
  readonly projectionRef: MutableRefObject<CameraProjection>;
  readonly restoringRef: MutableRefObject<boolean>;
  readonly ready: boolean;
  readonly appProjection: WorldMapChartProps["state"]["projection"];
  readonly centre: number;
  readonly initialFocusAreaId: string | null;
  readonly initialFocusNationId: string | null;
  readonly setProjection: (next: CameraProjection) => void;
}

export function useCameraSync({
  mapRef,
  projectionRef,
  restoringRef,
  ready,
  appProjection,
  centre,
  initialFocusAreaId,
  initialFocusNationId,
  setProjection,
}: CameraSyncInput) {
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const next = adapterProjectionFromApp(appProjection);
    if (next !== projectionRef.current) {
      map.setProjection({ type: next });
      setProjection(next);
      projectionRef.current = next;
    }
  }, [ready, appProjection, mapRef, projectionRef, setProjection]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready || restoringRef.current) return;
    map.setCenter([centre, map.getCenter().lat]);
  }, [ready, centre]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready || restoringRef.current) return;
    const point = homeFocusPoint(initialFocusAreaId);
    if (point === null) return;
    const target = nationFocusPoint(point, initialFocusNationId);
    map.jumpTo({ center: [target[0], target[1]], zoom: 3.5, bearing: 0, pitch: 0 });
  }, [initialFocusAreaId, initialFocusNationId, ready]);

  useEffect(() => {
    if (ready) restoringRef.current = false;
  }, [ready]);
}
