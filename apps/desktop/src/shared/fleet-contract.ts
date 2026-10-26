import type {
  FleetArea,
  FleetAreaEdge,
  FleetDivisionView,
  FleetOverBaseShip,
  FleetPort,
  MovementCommand,
  PlayerProjectionPresence,
} from "@bluewave/campaign-engine";
import type { ExplanationTree } from "@bluewave/events";
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
  ShipCondition,
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
  readonly training?: FleetTrainingProjection;
  readonly exercise?: FleetExerciseProjection;
}

export type TrainingSubjectId = "GUNNERY" | "NIGHT_FIGHTING" | "TORPEDO_TACTICS" | "DAMAGE_CONTROL";

export interface FleetTrainingSubjectView {
  readonly subject: TrainingSubjectId;
  readonly maintenanceAdderBp: number;
  readonly maintenanceAdderExplanation?: ExplanationTree;
  readonly funded: boolean;
  readonly fundedMonths: number;
  readonly monthsToProficiency: number;
  readonly progressExplanation?: ExplanationTree;
  readonly proficient: boolean;
}

export interface FleetTrainingProjection {
  readonly maxSubjects: number;
  readonly proficiencyMonths: number;
  readonly subjects: readonly FleetTrainingSubjectView[];
}

export interface FleetExerciseProjection {
  readonly maxPerCalendarYear: number;
  readonly maintenanceMultiple: number;
  readonly experienceGain: number;
  readonly experienceGainExplanation?: ExplanationTree;
  readonly nextExerciseYear: number;
  readonly heldInNextExerciseYear: number;
  readonly scheduled?: { readonly month: string; readonly shipIds: readonly string[] };
}

export interface SubmitFleetExercisePayload extends CommandEnvelope {
  readonly shipIds: readonly string[];
}

export interface FleetExerciseOutcome {
  readonly commandId: string;
  readonly shipCount: number;
  readonly appliedOnNextTurn: true;
}

export interface SubmitSpecialTrainingPayload extends CommandEnvelope {
  readonly subjects: readonly TrainingSubjectId[];
}

export interface SpecialTrainingOutcome {
  readonly commandId: string;
  readonly subjects: readonly TrainingSubjectId[];
  readonly appliedOnNextTurn: true;
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
