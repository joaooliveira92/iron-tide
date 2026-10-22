import { useCallback, useState } from "react";
import { type LiveWorldMapOverlay } from "./campaign-map-join.js";
import { useLiveWorldMapOverlay } from "./useLiveWorldMapOverlay.js";
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
import type { AreaId } from "./fixture-world.js";

export interface WorldMapController {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly overlay: LiveWorldMapOverlay;
  readonly onSelect: (area: AreaId | null) => void;
  readonly onRuler: (area: AreaId) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onSetCentre: (centre: number) => void;
  readonly onToggleClosedPassages: () => void;
}

export function useWorldMapController(sessionId: string | null): WorldMapController {
  const [state, setState] = useState(initialMapPrototypeState);
  const overlay = useLiveWorldMapOverlay(sessionId);

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
  const onToggleClosedPassages = useCallback(
    () =>
      setState((current) => ({
        ...current,
        respectClosedPassages: !current.respectClosedPassages,
      })),
    [],
  );

  return {
    state,
    route: readRoute(state),
    overlay,
    onSelect,
    onRuler,
    onToggleLayer,
    onSetProjection,
    onSetCentre,
    onToggleClosedPassages,
  };
}
