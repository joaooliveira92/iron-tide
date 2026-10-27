import { useCallback, useState } from "react";
import type { StrategicMapView } from "@bluewave/campaign-engine";
import { type LiveWorldMapOverlay } from "./campaign-map-join.js";
import { useLiveWorldMapOverlay, type LiveWorldMapRead } from "./useLiveWorldMapOverlay.js";
import {
  initialMapPrototypeState,
  pushRuler,
  readRoute,
  selectArea,
  toggleLayer,
  type LayerId,
  type MapPrototypeState,
  type RouteReading,
} from "./map-state.js";
import type { ProjectionId } from "./projection.js";
import type { AreaId } from "./map-geometry.js";

export interface WorldMapController {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly overlay: LiveWorldMapOverlay;
  readonly strategic: StrategicMapView | null;
  readonly status: LiveWorldMapRead["status"];
  readonly reason: string | null;
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
  const [state, setState] = useState(initialMapPrototypeState);
  const map = useLiveWorldMapOverlay(sessionId, revision, refreshToken);

  const onSelect = useCallback(
    (area: AreaId | null) => setState((current) => selectArea(current, area)),
    [],
  );
  const onRuler = useCallback(
    (area: AreaId) => setState((current) => pushRuler(current, area)),
    [],
  );
  const onToggleLayer = useCallback(
    (layer: LayerId) => setState((current) => toggleLayer(current, layer)),
    [],
  );
  const onSetProjection = useCallback(
    (projection: ProjectionId) => setState((current) => ({ ...current, projection })),
    [],
  );
  const onSetCentre = useCallback(
    (centre: number) => setState((current) => ({ ...current, centre })),
    [],
  );
  return {
    state,
    route: readRoute(state, map.overlay.lanes ?? []),
    overlay: map.overlay,
    strategic: map.strategic,
    status: map.status,
    reason: map.reason,
    onSelect,
    onRuler,
    onToggleLayer,
    onSetProjection,
    onSetCentre,
  };
}
