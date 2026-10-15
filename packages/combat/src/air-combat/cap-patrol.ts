//packages/combat/src/air-combat/cap-patrol.ts
// D-3 M4 Aviation: CAP & Strikes — INC-1 (AC-1, AC-2, AC-3).
// CAP patrol state, detection of incoming strikes, interception timing.
// Pure deterministic functions — no I/O, no random, no Date.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  AIR_COMBAT_RULESET_VERSION,
  AIR_COMBAT_SPEED_SCORE_MULTIPLIER_BP,
  AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP,
  AIR_COMBAT_MIN_SPEED_MPS,
  AIR_COMBAT_SENSOR_RANGE_MULTIPLIER,
  CAP_DEFAULT_PATROL_ALTITUDE,
  type CapEngagementState,
  type CapPatrolAltitude,
  type DetectionOutcome,
} from "./constants.js";
import { AIR_COMBAT_INVALID_STATE } from "./reasonCodes.js";

// ---- CapPatrolState ----

export interface CapPatrolState {
  squadronId: string;
  stationPosition: [number, number];
  altitude: CapPatrolAltitude;
  fuelRemainingMinutes: SafeInt;
  engagementState: CapEngagementState;
  interceptTargetId: string | null;
  interceptEtaMinutes: SafeInt;
  rulesetVersion: string;
}

// ---- createCapPatrolState ----

/**
 * Creates a CAP patrol state for a CAP-eligible squadron.
 *
 * @param squadronId - Unique identifier of the squadron.
 * @param missionAvailability - List of mission role strings the squadron can perform.
 * @param operationalAircraftCount - Number of operationally ready aircraft.
 * @param rangeDistance - Aircraft model's range distance (used for fuel heuristic).
 * @param speedScore - Aircraft model's speed score (0-100).
 * @param stationPosition - [x, y] position of the patrol station (parent carrier/formation).
 * @returns A valid CapPatrolState.
 * @throws BluewaveError with AIR_COMBAT_INVALID_STATE if validation fails.
 */
export function createCapPatrolState(
  squadronId: string,
  missionAvailability: readonly string[],
  operationalAircraftCount: SafeInt,
  rangeDistance: SafeInt,
  speedScore: SafeInt,
  stationPosition: [number, number],
): CapPatrolState {
  // Validate squadronId
  if (typeof squadronId !== "string" || squadronId.length === 0) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "squadronId",
      value: squadronId,
      reason: "squadronId must be a non-empty string",
    });
  }

  // Validate missionAvailability contains "CAP"
  if (!Array.isArray(missionAvailability) || !missionAvailability.includes("CAP")) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "missionAvailability",
      value: missionAvailability,
      reason: "squadron must have 'CAP' in missionAvailability",
    });
  }

  // Validate operationalAircraftCount > 0
  if (
    !SafeInt.isSafeInt(Number(operationalAircraftCount)) ||
    Number(operationalAircraftCount) <= 0
  ) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "operationalAircraftCount",
      value: Number(operationalAircraftCount),
      reason: "squadron must have at least 1 operational aircraft",
    });
  }

  // Validate stationPosition is a valid tuple
  if (
    !Array.isArray(stationPosition) ||
    stationPosition.length !== 2 ||
    typeof stationPosition[0] !== "number" ||
    typeof stationPosition[1] !== "number"
  ) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "stationPosition",
      value: stationPosition,
      reason: "stationPosition must be a [number, number] tuple",
    });
  }

  // Validate rangeDistance and speedScore are SafeInts
  if (!SafeInt.isSafeInt(Number(rangeDistance)) || Number(rangeDistance) < 0) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "rangeDistance",
      value: Number(rangeDistance),
      reason: "rangeDistance must be a non-negative SafeInt",
    });
  }

  if (!SafeInt.isSafeInt(Number(speedScore)) || Number(speedScore) < 0) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "speedScore",
      value: Number(speedScore),
      reason: "speedScore must be a non-negative SafeInt",
    });
  }

  // Fuel heuristic: rangeDistance / max(1, speedScore) minutes (rough estimate)
  const denom = Number(speedScore) < 1 ? SafeInt.ONE : speedScore;
  const fuelRemainingMinutes = SafeInt.div(rangeDistance, denom, "floor");

  // Default altitude = MEDIUM
  const altitude: CapPatrolAltitude = CAP_DEFAULT_PATROL_ALTITUDE;

  return {
    squadronId,
    stationPosition,
    altitude,
    fuelRemainingMinutes,
    engagementState: "PATROLLING",
    interceptTargetId: null,
    interceptEtaMinutes: SafeInt.ZERO,
    rulesetVersion: AIR_COMBAT_RULESET_VERSION,
  };
}

// ---- computeDetection ----

/**
 * Determines if a CAP patrol detects an incoming strike formation.
 * Uses the B-2 spotting model: detection range = capSensorValue * 1000m.
 *
 * @param capSensorValue - Sensor/spotting value of the CAP aircraft (SafeInt).
 * @param strikeSignature - Strike formation's signature/stealth factor (SafeInt).
 * @param distanceM - Distance between CAP patrol and strike formation in meters (SafeInt).
 * @returns DetectionOutcome: DETECTED, UNDETECTED, or TOO_LATE.
 */
export function computeDetection(
  capSensorValue: SafeInt,
  strikeSignature: SafeInt,
  distanceM: SafeInt,
): DetectionOutcome {
  // Edge: blind CAP (sensor <= 0) → UNDETECTED
  if (Number(capSensorValue) <= 0) {
    return "UNDETECTED";
  }

  // Edge: perfectly stealthy strike (signature <= 0) → UNDETECTED
  if (Number(strikeSignature) <= 0) {
    return "UNDETECTED";
  }

  // Detection range = capSensorValue * 1000 meters
  const detectionRangeM = SafeInt.mul(capSensorValue, SafeInt(AIR_COMBAT_SENSOR_RANGE_MULTIPLIER));

  // If distance > detection range → undetected
  if (Number(distanceM) > Number(detectionRangeM)) {
    return "UNDETECTED";
  }

  // Within range → detected
  return "DETECTED";
}

// ---- Speed conversion ----

/**
 * Converts an aircraft speed score to meters per second.
 * Formula: mps = speedScore * 2.5 + 20
 *
 * Uses integer basis-point arithmetic to avoid floating point:
 *   mps_bp = speedScore * 25_000 + 200_000
 *   mps = floor(mps_bp / 10_000)
 *
 * @param speedScore - Aircraft speed score (SafeInt, 0-100).
 * @returns Speed in meters per second (SafeInt), minimum 20.
 */
export function convertSpeedToMps(speedScore: SafeInt): SafeInt {
  // speedScore * 25_000 + 200_000 (basis points)
  const mpsBp = SafeInt.add(
    SafeInt.mul(speedScore, SafeInt(AIR_COMBAT_SPEED_SCORE_MULTIPLIER_BP)),
    SafeInt(AIR_COMBAT_MIN_SPEED_MPS * AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP),
  );
  // floor(mpsBp / 10_000)
  const mps = SafeInt.div(mpsBp, SafeInt(AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP), "floor");
  return mps;
}

// ---- computeInterceptionTime ----

/**
 * Compute the time (in minutes) for a CAP patrol to intercept a strike formation,
 * including a fuel-check that may return TOO_LATE.
 *
 * Time formula:
 *   speedMps = speedScore * 2.5 + 20
 *   timeMinutes = ceil(distanceM / max(1, speedMps * 60))
 *
 * If timeMinutes > fuelRemainingMinutes, the intercept is impossible → TOO_LATE.
 *
 * @param distanceM - Distance from CAP patrol to strike in meters (SafeInt).
 * @param interceptSpeedScore - Speed score of the intercepting aircraft (SafeInt, 0-100).
 * @param fuelRemainingMinutes - Minutes of fuel remaining for the CAP aircraft (SafeInt).
 * @returns Object with timeMinutes and outcome.
 */
export function computeInterceptionTime(
  distanceM: SafeInt,
  interceptSpeedScore: SafeInt,
  fuelRemainingMinutes: SafeInt,
): { timeMinutes: SafeInt; outcome: DetectionOutcome } {
  // Convert speed score to m/s
  const speedMps = convertSpeedToMps(interceptSpeedScore);

  // Meters per minute: speedMps * 60
  const metersPerMinute = SafeInt.mul(speedMps, SafeInt(60));

  // Denominator: at least 1 to avoid division by zero
  const denominator = Number(metersPerMinute) < 1 ? SafeInt.ONE : metersPerMinute;

  // timeMinutes = ceil(distanceM / denominator)
  const timeMinutes = SafeInt.div(distanceM, denominator, "ceil");

  // Fuel check: if time > fuel → TOO_LATE
  if (Number(timeMinutes) > Number(fuelRemainingMinutes)) {
    return { timeMinutes, outcome: "TOO_LATE" as DetectionOutcome };
  }

  return { timeMinutes, outcome: "DETECTED" as DetectionOutcome };
}
