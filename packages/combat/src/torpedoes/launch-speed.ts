import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_KNOTS_TO_UM_S,
  TORPEDO_MOUNT_TYPES,
  type TorpedoMountType,
  UNDERWATER_TUBE_MAX_SPEED_UM_S,
} from "./constants.js";
import {
  TORPEDO_LAUNCH_SPEED_LIMIT_MISSING,
  TORPEDO_STATE_INVARIANT_FAILED,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
} from "./reasonCodes.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function assertSpeedInput(speedUmS: number, field: string): void {
  if (!Number.isInteger(speedUmS) || !Number.isSafeInteger(speedUmS) || speedUmS < 0)
    invariant(field, speedUmS, "speed must be a non-negative safe integer micrometres-per-second");
}

export interface SpeedLimitVerdict {
  applicable: boolean;
  allowed: boolean;
  reasonCode: "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED" | "TORPEDO_LAUNCH_SPEED_LIMIT_MISSING" | null;
  speedUmS: number;
  limitUmS: number | null;
}

function evaluateUnderwaterTubeSpeedLimit(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  assertSpeedInput(speedUmS, "currentSpeedMicrometresPerSecond");
  if (!(TORPEDO_MOUNT_TYPES as readonly string[]).includes(mountType))
    invariant("mountType", mountType, "mountType must be one of the five DESIGN-40 §2 values");
  const governed = mountType === "UNDERWATER_FIXED" || mountType === "UNDERWATER_TRAINABLE";
  if (!governed) {
    return { applicable: false, allowed: true, reasonCode: null, speedUmS, limitUmS: null };
  }
  if (speedUmS > UNDERWATER_TUBE_MAX_SPEED_UM_S) {
    return {
      applicable: true,
      allowed: false,
      reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
      speedUmS,
      limitUmS: UNDERWATER_TUBE_MAX_SPEED_UM_S,
    };
  }
  return {
    applicable: true,
    allowed: true,
    reasonCode: null,
    speedUmS,
    limitUmS: UNDERWATER_TUBE_MAX_SPEED_UM_S,
  };
}

export function validateUnderwaterTubeSpeedLimitCommand(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  return evaluateUnderwaterTubeSpeedLimit(speedUmS, mountType);
}

export function validateUnderwaterTubeSpeedLimitFiringSubstep(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  return evaluateUnderwaterTubeSpeedLimit(speedUmS, mountType);
}

export function validateUnderwaterTubeSpeedLimit(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  return evaluateUnderwaterTubeSpeedLimit(speedUmS, mountType);
}

export function validateAboveWaterLaunchSpeedLimit(
  speedUmS: number,
  resolvedMaxLaunchSpeedKnots: number | null,
): SpeedLimitVerdict {
  assertSpeedInput(speedUmS, "currentSpeedMicrometresPerSecond");
  if (resolvedMaxLaunchSpeedKnots === null) {
    return {
      applicable: true,
      allowed: false,
      reasonCode: TORPEDO_LAUNCH_SPEED_LIMIT_MISSING,
      speedUmS,
      limitUmS: null,
    };
  }
  if (!Number.isInteger(resolvedMaxLaunchSpeedKnots) || resolvedMaxLaunchSpeedKnots <= 0)
    invariant(
      "resolvedMaxLaunchSpeedKnots",
      resolvedMaxLaunchSpeedKnots,
      "resolved §8 maximum launch speed must be a positive integer knots",
    );
  const limitUmS = resolvedMaxLaunchSpeedKnots * TORPEDO_KNOTS_TO_UM_S;
  if (!Number.isSafeInteger(limitUmS))
    invariant(
      "resolvedMaxLaunchSpeedKnots",
      resolvedMaxLaunchSpeedKnots,
      "resolved §8 maximum launch speed conversion produced an unsafe integer",
    );
  if (speedUmS > limitUmS) {
    return {
      applicable: true,
      allowed: false,
      reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
      speedUmS,
      limitUmS,
    };
  }
  return { applicable: true, allowed: true, reasonCode: null, speedUmS, limitUmS };
}

export type TorpedoLaunchOutcome =
  | { status: "SUCCESSFUL_LAUNCH"; failedLaunch: false; torpedoConsumed: true }
  | {
      status: "FAILED_LAUNCH";
      failedLaunch: true;
      torpedoConsumed: false;
      reasonCode: "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED";
    };
