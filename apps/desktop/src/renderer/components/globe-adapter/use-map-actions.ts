import { useCallback, type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";
import { adapterProjectionFromApp } from "./adapter-layer-state.js";
import { fitWorldCamera, type CameraProjection } from "./camera-contract.js";

export interface MapActionsInput {
  readonly mapRef: MutableRefObject<MapLibreMap | null>;
  readonly projectionRef: MutableRefObject<CameraProjection>;
  readonly centre: number;
  readonly setProjection: (next: CameraProjection) => void;
  readonly onSetProjection: WorldMapChartProps["onSetProjection"];
  readonly onSetCentre: WorldMapChartProps["onSetCentre"];
}

export interface MapActions {
  readonly resetView: () => void;
  readonly handleSetProjection: (
    next: NonNullable<WorldMapChartProps["state"]["projection"]>,
  ) => void;
  readonly recentre: (lon: number, lat: number) => void;
}

export function useMapActions({
  mapRef,
  projectionRef,
  centre,
  setProjection,
  onSetProjection,
  onSetCentre,
}: MapActionsInput): MapActions {
  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (map === null) return;
    const next = fitWorldCamera(projectionRef.current);
    map.jumpTo({
      center: [centre, next.centre[1]],
      zoom: next.zoom,
      bearing: 0,
      pitch: 0,
    });
  }, [centre, mapRef, projectionRef]);

  const setProjectionMode = useCallback(
    (next: CameraProjection) => {
      const map = mapRef.current;
      if (map === null) return;
      map.setProjection({ type: next });
      setProjection(next);
      projectionRef.current = next;
    },
    [mapRef, projectionRef, setProjection],
  );

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
    [mapRef, onSetCentre],
  );

  return { resetView, handleSetProjection, recentre };
}
