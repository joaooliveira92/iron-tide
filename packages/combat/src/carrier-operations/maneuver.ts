import { BluewaveError } from "@bluewave/contracts";
import {
  WOD_PISTON_LAUNCH_MIN_KNOTS,
  WOD_PISTON_RECOVERY_MIN_KNOTS,
  WOD_LIGHT_JET_LAUNCH_MIN_KNOTS,
  WOD_LIGHT_JET_RECOVERY_MIN_KNOTS,
  WOD_HEAVY_JET_LAUNCH_MIN_KNOTS,
  WOD_HEAVY_JET_RECOVERY_MIN_KNOTS,
  WOD_HELICOPTER_DEFAULT_MIN_KNOTS,
} from "./constants.js";
import {
  CARRIER_WIND_OVER_DECK_INSUFFICIENT,
  CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION,
} from "./reasonCodes.js";

export interface CarrierManeuverCommand {
  requiredCourse: CourseInterval;
  requiredSpeed: SpeedInterval;
  windVector: WindVector;
  deckOperationId: string;
  startMinute: number;
  endMinute: number;
  collisionConstraints: readonly string[];
  formationConstraints: readonly string[];
  failureBehavior: ManeuverFailureBehavior;
}

export interface CourseInterval {
  minDegrees: number;
  maxDegrees: number;
}

export interface SpeedInterval {
  minKnots: number;
  maxKnots: number;
}

export interface WindVector {
  ambientWindSpeedKnots: number;
  ambientWindDirectionDegrees: number;
  carrierSpeedKnots: number;
  carrierCourseDegrees: number;
}

export type ManeuverFailureBehavior = "DELAY_OPERATION" | "SUSPEND_OPERATION" | "ABORT_OPERATION";

export function relativeWindOverDeckKnots(wind: WindVector): number {
  const angleDiff = Math.abs(wind.ambientWindDirectionDegrees - wind.carrierCourseDegrees);
  const headwindComponent = wind.ambientWindSpeedKnots * Math.cos((angleDiff * Math.PI) / 180);
  return Math.round(wind.carrierSpeedKnots + headwindComponent);
}

export function assertManeuverNotLocked(
  currentDeckOperationId: string | undefined,
  requestedOperationId: string,
): void {
  if (currentDeckOperationId !== undefined && currentDeckOperationId !== requestedOperationId) {
    throw new BluewaveError(CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION, {
      code: CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION,
      field: "currentDeckOperationId",
      reason: `carrier maneuver locked by deck operation ${currentDeckOperationId}`,
      value: { currentDeckOperationId, requestedOperationId },
    });
  }
}

export type AircraftClass = "PISTON" | "LIGHT_JET" | "HEAVY_JET" | "HELICOPTER" | "UNKNOWN";

export function minimumWindOverDeckForLaunch(aircraftClass: AircraftClass): number {
  switch (aircraftClass) {
    case "PISTON":
      return WOD_PISTON_LAUNCH_MIN_KNOTS;
    case "LIGHT_JET":
      return WOD_LIGHT_JET_LAUNCH_MIN_KNOTS;
    case "HEAVY_JET":
      return WOD_HEAVY_JET_LAUNCH_MIN_KNOTS;
    case "HELICOPTER":
      return WOD_HELICOPTER_DEFAULT_MIN_KNOTS;
    default:
      return WOD_PISTON_LAUNCH_MIN_KNOTS;
  }
}

export function minimumWindOverDeckForRecovery(aircraftClass: AircraftClass): number {
  switch (aircraftClass) {
    case "PISTON":
      return WOD_PISTON_RECOVERY_MIN_KNOTS;
    case "LIGHT_JET":
      return WOD_LIGHT_JET_RECOVERY_MIN_KNOTS;
    case "HEAVY_JET":
      return WOD_HEAVY_JET_RECOVERY_MIN_KNOTS;
    case "HELICOPTER":
      return WOD_HELICOPTER_DEFAULT_MIN_KNOTS;
    default:
      return WOD_PISTON_RECOVERY_MIN_KNOTS;
  }
}

export function checkWindOverDeckSufficient(
  wodKnots: number,
  aircraftClass: AircraftClass,
  isLaunch: boolean,
): boolean {
  const minKnots = isLaunch
    ? minimumWindOverDeckForLaunch(aircraftClass)
    : minimumWindOverDeckForRecovery(aircraftClass);
  return wodKnots >= minKnots;
}

export function assertWindOverDeckSufficient(
  wodKnots: number,
  aircraftClass: AircraftClass,
  isLaunch: boolean,
  operationLabel: string,
): void {
  const minKnots = isLaunch
    ? minimumWindOverDeckForLaunch(aircraftClass)
    : minimumWindOverDeckForRecovery(aircraftClass);
  if (wodKnots < minKnots) {
    throw new BluewaveError(CARRIER_WIND_OVER_DECK_INSUFFICIENT, {
      code: CARRIER_WIND_OVER_DECK_INSUFFICIENT,
      field: "windOverDeckKnots",
      reason: `${operationLabel} requires ${minKnots}kt wind-over-deck, got ${wodKnots}kt`,
      value: { wodKnots, minKnots, aircraftClass, isLaunch },
    });
  }
}
