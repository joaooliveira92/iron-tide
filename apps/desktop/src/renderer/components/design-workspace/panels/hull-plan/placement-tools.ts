/**
 * Public surface of the hull plan's placement tools. The logic lives in focused modules — `plan-targeting`
 * (point to station/zone/side), `placement-edits` (pure `DraftEdit` builders), `plan-pointer` (screen to plan)
 * and `auto-place` (the compile-backed search) — and is re-exported here so callers keep one import.
 */
export {
  CENTRE_BAND,
  STATION_SNAP_PERMILLE,
  planTarget,
  sideAtY,
  stationAtX,
  zoneAtStation,
  type PlanTarget,
  type ZoneSpan,
} from "./plan-targeting.js";
export {
  NUDGE_PERMILLE,
  hasSide,
  moveEdit,
  nextInstanceId,
  nudgeEdit,
  placeEdit,
  type PlanEdit,
} from "./placement-edits.js";
export { GRAB_RADIUS, clientToPlan, fittingAt } from "./plan-pointer.js";
export { AUTO_PLACE_STATIONS, autoPlace } from "./auto-place.js";
