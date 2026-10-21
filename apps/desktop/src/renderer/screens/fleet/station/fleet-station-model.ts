import type { FleetScreenProjection } from "../../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";

/** What the foreign-station section holds of the engine's fleet projection. */
export interface FleetStationState extends RequestLifecycle {
  readonly divisions: FleetScreenProjection["divisions"];
  readonly areas: FleetScreenProjection["areas"];
  readonly presence: FleetScreenProjection["presence"];
  readonly overBaseShips: FleetScreenProjection["overBaseShips"];
}

export function initialFleetStationState(): FleetStationState {
  return {
    revision: 0,
    divisions: [],
    areas: [],
    presence: { configured: false },
    overBaseShips: [],
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectFleetStation(projection: FleetScreenProjection): Partial<FleetStationState> {
  return {
    divisions: projection.divisions,
    areas: projection.areas,
    presence: projection.presence,
    overBaseShips: projection.overBaseShips,
  };
}
