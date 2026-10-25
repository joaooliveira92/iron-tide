import type {
  FleetArea,
  FleetAreaEdge,
  FleetDivisionView,
  FleetOverBaseShip,
  FleetPort,
  MovementCommand,
  PlayerProjectionPresence,
} from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

export type {
  FleetArea,
  FleetAreaEdge,
  FleetDivisionView,
  FleetOverBaseShip,
  FleetPort,
  FleetShipView,
  PlayerProjectionPresence,
  PlayerProjectionPresenceArea,
} from "@bluewave/campaign-engine";

export interface FleetScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly playerNationId: string;
  readonly divisions: readonly FleetDivisionView[];
  readonly areas: readonly FleetArea[];
  readonly areaEdges: readonly FleetAreaEdge[];
  readonly ports: readonly FleetPort[];
  readonly movementCommands: readonly MovementCommand[];
  readonly presence: PlayerProjectionPresence;
  readonly overBaseShips: readonly FleetOverBaseShip[];
}

export interface MovementCommandOutcome {
  readonly workspace: { readonly movementCommands: readonly MovementCommand[] };
  readonly command: { readonly commandId: string; readonly status: string };
}

export interface SubmitMovementCommandPayload extends CommandEnvelope {
  readonly divisionId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
}

export interface ReplaceMovementCommandPayload extends SubmitMovementCommandPayload {
  readonly commandId: string;
}

export interface CancelMovementCommandPayload extends CommandEnvelope {
  readonly commandId: string;
}

export type StationAssignmentIntent = "assign" | "clear";

export interface SubmitStationAssignmentPayload extends CommandEnvelope {
  readonly intent: StationAssignmentIntent;
  readonly shipIds: readonly string[];
}

export type CommandableReadiness = "ACTIVE" | "RESERVE" | "MOTHBALLED";

export interface SubmitShipReadinessPayload extends CommandEnvelope {
  readonly readiness: CommandableReadiness;
  readonly shipIds: readonly string[];
}

export interface ShipReadinessOutcome {
  readonly commandId: string;
  readonly readiness: CommandableReadiness;
  readonly shipCount: number;
  readonly appliedOnNextTurn: true;
}

export interface StationAssignmentOutcome {
  readonly commandId: string;
  readonly intent: StationAssignmentIntent;
  readonly shipCount: number;
  readonly appliedOnNextTurn: true;
}
