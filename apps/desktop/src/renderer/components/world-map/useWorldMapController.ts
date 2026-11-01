import { useCallback, useMemo, useState } from "react";
import type { StrategicMapView } from "@bluewave/campaign-engine";
import type { AppCameraState } from "../globe-adapter/camera-contract.js";
import { type LiveWorldMapOverlay } from "./campaign-map-join.js";
import { useSharedWorldMap } from "./shared-world-map.js";
import { useLiveWorldMapOverlay, type LiveWorldMapRead } from "./useLiveWorldMapOverlay.js";
import {
  initialMapPrototypeState,
  pushRuler,
  readRoute,
  selectArea,
  toggleLayer,
  type LayerId,
  type MapPrototypeState,
  type RouteLane,
  type RouteReading,
} from "./map-state.js";
import type { ProjectionId } from "./projection.js";
import type { AreaId } from "./map-geometry.js";

const NO_ROUTE_LANES: readonly RouteLane[] = [];

export interface WorldMapController {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly overlay: LiveWorldMapOverlay;
  readonly strategic: StrategicMapView | null;
  readonly status: LiveWorldMapRead["status"];
  readonly reason: string | null;
  readonly camera: AppCameraState | null;
  readonly onCameraChange: ((camera: AppCameraState) => void) | undefined;
  readonly onSelect: (area: AreaId | null) => void;
  readonly onRuler: (area: AreaId) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onSetCentre: (centre: number) => void;
}

export function useWorldMapController(
  sessionId: string | null,
  revision: number | null = null,
  refreshToken = 0,
): WorldMapController {
  const shared = useSharedWorldMap();
  const [localState, setLocalState] = useState(initialMapPrototypeState);
  const state = shared === null ? localState : shared.state;
  const setState = shared === null ? setLocalState : shared.setState;
  const map = useLiveWorldMapOverlay(sessionId, revision, refreshToken);
  const lanes = map.overlay.lanes ?? NO_ROUTE_LANES;
  const route = useMemo(() => readRoute(state, lanes), [lanes, state]);

  const onSelect = useCallback(
    (area: AreaId | null) => setState((current) => selectArea(current, area)),
    [setState],
  );
  const onRuler = useCallback(
    (area: AreaId) => setState((current) => pushRuler(current, area)),
    [setState],
  );
  const onToggleLayer = useCallback(
    (layer: LayerId) => setState((current) => toggleLayer(current, layer)),
    [setState],
  );
  const onSetProjection = useCallback(
    (projection: ProjectionId) => setState((current) => ({ ...current, projection })),
    [setState],
  );
  const onSetCentre = useCallback(
    (centre: number) => setState((current) => ({ ...current, centre })),
    [setState],
  );
  const camera = shared === null ? null : shared.camera;
  const onCameraChange = shared === null ? undefined : shared.setCamera;
  return useMemo(
    () => ({
      state,
      route,
      overlay: map.overlay,
      strategic: map.strategic,
      status: map.status,
      reason: map.reason,
      camera,
      onSelect,
      onRuler,
      onToggleLayer,
      onSetProjection,
      onSetCentre,
      onCameraChange,
    }),
    [
      camera,
      map.overlay,
      map.reason,
      map.status,
      map.strategic,
      onRuler,
      onCameraChange,
      onSelect,
      onSetCentre,
      onSetProjection,
      onToggleLayer,
      route,
      state,
    ],
  );
}
