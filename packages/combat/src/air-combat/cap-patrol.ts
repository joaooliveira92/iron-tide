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

export function createCapPatrolState(
  squadronId: string,
  missionAvailability: readonly string[],
  operationalAircraftCount: SafeInt,
  rangeDistance: SafeInt,
  speedScore: SafeInt,
  stationPosition: [number, number],
): CapPatrolState {
  if (typeof squadronId !== "string" || squadronId.length === 0) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "squadronId",
      value: squadronId,
      reason: "squadronId must be a non-empty string",
    });
  }

  if (!Array.isArray(missionAvailability) || !missionAvailability.includes("CAP")) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STATE, {
      code: AIR_COMBAT_INVALID_STATE,
      field: "missionAvailability",
      value: missionAvailability,
      reason: "squadron must have 'CAP' in missionAvailability",
    });
  }

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

  const denom = Number(speedScore) < 1 ? SafeInt.ONE : speedScore;
  const fuelRemainingMinutes = SafeInt.div(rangeDistance, denom, "floor");

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

export function computeDetection(
  capSensorValue: SafeInt,
  strikeSignature: SafeInt,
  distanceM: SafeInt,
): DetectionOutcome {
  if (Number(capSensorValue) <= 0) {
    return "UNDETECTED";
  }

  if (Number(strikeSignature) <= 0) {
    return "UNDETECTED";
  }

  const detectionRangeM = SafeInt.mul(capSensorValue, SafeInt(AIR_COMBAT_SENSOR_RANGE_MULTIPLIER));

  if (Number(distanceM) > Number(detectionRangeM)) {
    return "UNDETECTED";
  }

  return "DETECTED";
}

export function convertSpeedToMps(speedScore: SafeInt): SafeInt {
  const mpsBp = SafeInt.add(
    SafeInt.mul(speedScore, SafeInt(AIR_COMBAT_SPEED_SCORE_MULTIPLIER_BP)),
    SafeInt(AIR_COMBAT_MIN_SPEED_MPS * AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP),
  );
  const mps = SafeInt.div(mpsBp, SafeInt(AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP), "floor");
  return mps;
}

export function computeInterceptionTime(
  distanceM: SafeInt,
  interceptSpeedScore: SafeInt,
  fuelRemainingMinutes: SafeInt,
): { timeMinutes: SafeInt; outcome: DetectionOutcome } {
  const speedMps = convertSpeedToMps(interceptSpeedScore);

  const metersPerMinute = SafeInt.mul(speedMps, SafeInt(60));

  const denominator = Number(metersPerMinute) < 1 ? SafeInt.ONE : metersPerMinute;

  const timeMinutes = SafeInt.div(distanceM, denominator, "ceil");

  if (Number(timeMinutes) > Number(fuelRemainingMinutes)) {
    return { timeMinutes, outcome: "TOO_LATE" as DetectionOutcome };
  }

  return { timeMinutes, outcome: "DETECTED" as DetectionOutcome };
}
