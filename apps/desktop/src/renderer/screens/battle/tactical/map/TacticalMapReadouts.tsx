import { useSyncExternalStore } from "react";
import { formatMeasurement } from "../../../../lib/presentation-format/format.js";
import { UM_PER_NAUTICAL_MILE } from "../../../../lib/presentation-format/units.js";
import { translate } from "../../../../lib/strings.js";
import { useBattleCameraState, useBattleState } from "../../session/battle-session-contexts.js";
import { compassFromHeading, screenToWorld } from "../tactical-geometry.js";
import { shipPoint } from "../tactical-model.js";
import { useTacticalMap } from "./tactical-map-context.js";

function CursorDistance() {
  const { cursor, viewport, measurement, shipsById } = useTacticalMap();
  const state = useBattleState();
  const { camera } = useBattleCameraState();
  const point = useSyncExternalStore(cursor.subscribe, cursor.read);
  const selected = state.selectedShipId === null ? undefined : shipsById.get(state.selectedShipId);
  const origin = selected === undefined ? null : shipPoint(selected);
  if (point === null || origin === null) return null;
  const world = screenToWorld(camera, viewport, point);
  const distance = formatMeasurement(
    Math.round(Math.hypot(world[0] - origin[0], world[1] - origin[1])),
    measurement,
  );
  return (
    <p data-testid="tactical-cursor-distance">
      {translate("tactical.cursor.distance", { distance })}
    </p>
  );
}

export function TacticalMapConditions() {
  const { view, measurement } = useTacticalMap();
  return (
    <div
      data-testid="tactical-conditions"
      className="pointer-events-none absolute bottom-2 right-3 space-y-0.5 text-right text-xs font-medium text-slate-300"
    >
      <p>{translate("tactical.weather.sky", { sky: view.weather.precipitation.toLowerCase() })}</p>
      <p>{translate("tactical.weather.sea", { sea: view.weather.seaState.toLowerCase() })}</p>
      <p>
        {view.weather.daylight
          ? translate("tactical.weather.day")
          : translate("tactical.weather.night")}
      </p>
      <p data-testid="battle-weather">
        {translate("tactical.weather.visibility", {
          range: formatMeasurement(view.weather.visibilityNm * UM_PER_NAUTICAL_MILE, measurement),
        })}
      </p>
      <CursorDistance />
    </div>
  );
}

export function TacticalMapBearing() {
  const { shipsById } = useTacticalMap();
  const state = useBattleState();
  const selected = state.selectedShipId === null ? undefined : shipsById.get(state.selectedShipId);
  if (selected?.headingDeg == null) return null;
  return (
    <span className="sr-only" data-testid="tactical-selected-bearing">
      {String(compassFromHeading(selected.headingDeg))}
    </span>
  );
}
