import { BluewaveError } from "@bluewave/contracts";
import type { DivisionFormation } from "@bluewave/campaign";
import type { MovementState } from "./state.js";
import { assertFixedPointMovement } from "./state.js";
import {
  KNOTS_TO_UM_S,
  SPEED_BP_SCALE,
  DIRECTION_FIXED,
  DEG_TO_RAD,
  PROPULSION_ACCEL_KNOT_BP_PER_S,
  PROPULSION_DECEL_KNOT_BP_PER_S,
  LINE_AHEAD_COLUMN_INTERVAL_UM,
  LINE_AHEAD_DIVISION_GAP_UM,
  LINE_ABREAST_ABREAST_INTERVAL_UM,
  STATION_TOLERANCE_UM,
} from "./constants.js";
import { DIRECTION_TABLE } from "./directionTable.js";

function foldHeading(degrees: number): number {
  return (((degrees % 360) + 360) % 360) | 0;
}

export function speedBpKnotsToUmS(currentSpeedBpKnots: number): number {
  return Math.round((currentSpeedBpKnots * KNOTS_TO_UM_S) / SPEED_BP_SCALE);
}

export function directionBp(heading: number): { cosBp: number; sinBp: number } {
  const h = foldHeading(heading);
  const entry = DIRECTION_TABLE[h % 360] ?? ([0, 0] as readonly [number, number]);
  return { cosBp: entry[0], sinBp: entry[1] };
}

export interface AdvancePositionInput {
  state: MovementState;
  dtSeconds: number;
}
export function advancePosition(input: AdvancePositionInput): [number, number] {
  assertFixedPointMovement(input.state);
  if (!Number.isInteger(input.dtSeconds) || input.dtSeconds <= 0) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "dtSeconds",
      reason: "movement integration dt must be a positive integer",
      value: input.dtSeconds,
    });
  }
  const speedUmS = speedBpKnotsToUmS(input.state.currentSpeed);
  const distanceUm = speedUmS * input.dtSeconds;
  const { cosBp, sinBp } = directionBp(input.state.heading);
  const dX = Math.round((distanceUm * cosBp) / DIRECTION_FIXED);
  const dY = Math.round((distanceUm * sinBp) / DIRECTION_FIXED);
  return [input.state.position[0] + dX, input.state.position[1] + dY];
}

export interface PropulsionInput {
  currentSpeed: number;
  orderedSpeed: number;
  dtSeconds: number;
  attainableMaxBpKnots?: number;
}
export function resolvePropulsion(input: PropulsionInput): number {
  if (!Number.isInteger(input.currentSpeed) || !Number.isInteger(input.orderedSpeed)) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "propulsionSpeed",
      reason: "fixed-point",
      value: { currentSpeed: input.currentSpeed, orderedSpeed: input.orderedSpeed },
    });
  }
  if (!Number.isInteger(input.dtSeconds) || input.dtSeconds <= 0) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "dtSeconds",
      reason: "propulsion dt must be a positive integer",
      value: input.dtSeconds,
    });
  }
  let next = input.currentSpeed;
  if (next < input.orderedSpeed) {
    next = Math.min(input.orderedSpeed, next + PROPULSION_ACCEL_KNOT_BP_PER_S * input.dtSeconds);
  } else if (next > input.orderedSpeed) {
    next = Math.max(input.orderedSpeed, next - PROPULSION_DECEL_KNOT_BP_PER_S * input.dtSeconds);
  }
  if (input.attainableMaxBpKnots !== undefined) {
    next = Math.min(next, input.attainableMaxBpKnots);
  }
  return next;
}

export interface TurningInput {
  heading: number;
  orderedHeading: number;
  dtSeconds: number;
  turningRateMdegS?: number;
}
export function resolveTurning(input: TurningInput): number {
  if (
    !Number.isInteger(input.heading) ||
    !Number.isInteger(input.orderedHeading) ||
    !Number.isInteger(input.dtSeconds)
  ) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "turning",
      reason: "heading/dt must be integers",
      value: { heading: input.heading, orderedHeading: input.orderedHeading },
    });
  }
  const from = foldHeading(input.heading);
  const to = foldHeading(input.orderedHeading);
  let diff = (to - from) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const rate = input.turningRateMdegS ?? 1_000;
  const maxDeltaDeg = (rate * input.dtSeconds) / 1_000;
  let delta = Math.sign(diff) * Math.min(Math.abs(diff), maxDeltaDeg);
  delta = Math.round(delta);
  return foldHeading(from + delta);
}

export function reciprocalCourse(heading: number): number {
  return foldHeading(heading + 180);
}

export interface FormationStationContext {
  formation: DivisionFormation;
  ordinal: number;
  leadPosition: [number, number];
  leadHeading: number;
  divisionIndex?: number;
}
export interface DesiredStation {
  position: [number, number];
  heading: number;
  offStation: boolean;
}
export function computeDesiredStation(ctx: FormationStationContext): DesiredStation {
  const { cosBp, sinBp } = directionBp(ctx.leadHeading);
  let offsetAheadUm = 0;
  let offsetAbeamUm = 0;
  switch (ctx.formation) {
    case "LINE_AHEAD":
      offsetAheadUm = -ctx.ordinal * LINE_AHEAD_COLUMN_INTERVAL_UM;
      break;
    case "LINE_ABREAST":
      offsetAbeamUm = ctx.ordinal * LINE_ABREAST_ABREAST_INTERVAL_UM;
      break;
    case "SEARCH_LINE":
      offsetAheadUm = -ctx.ordinal * LINE_AHEAD_COLUMN_INTERVAL_UM;
      offsetAbeamUm = (ctx.divisionIndex ?? 0) * LINE_AHEAD_DIVISION_GAP_UM;
      break;
    case "SCREEN":
      offsetAheadUm = -ctx.ordinal * LINE_AHEAD_COLUMN_INTERVAL_UM;
      offsetAbeamUm = (ctx.divisionIndex ?? 0) * LINE_AHEAD_DIVISION_GAP_UM;
      break;
    default:
      offsetAheadUm = -ctx.ordinal * LINE_AHEAD_COLUMN_INTERVAL_UM;
  }
  const x =
    ctx.leadPosition[0] +
    (offsetAheadUm * cosBp) / DIRECTION_FIXED -
    (offsetAbeamUm * sinBp) / DIRECTION_FIXED;
  const y =
    ctx.leadPosition[1] +
    (offsetAheadUm * sinBp) / DIRECTION_FIXED +
    (offsetAbeamUm * cosBp) / DIRECTION_FIXED;
  const position: [number, number] = [Math.round(x), Math.round(y)];
  return { position, heading: ctx.leadHeading, offStation: false };
}

export function helmSteerToStation(
  state: MovementState,
  desired: DesiredStation,
  stationToleranceUm: number = STATION_TOLERANCE_UM,
): { orderedHeading: number; offStation: boolean } {
  const dx = desired.position[0] - state.position[0];
  const dy = desired.position[1] - state.position[1];
  const distSq = dx * dx + dy * dy;
  if (distSq <= stationToleranceUm * stationToleranceUm) {
    return { orderedHeading: desired.heading, offStation: false };
  }
  const headingDeg = Math.round((Math.atan2(dy, dx) / DEG_TO_RAD + 360) % 360);
  return { orderedHeading: headingDeg, offStation: true };
}

export function onStation(
  state: MovementState,
  desired: DesiredStation,
  distanceToleranceUm: number = STATION_TOLERANCE_UM,
): boolean {
  const dx = desired.position[0] - state.position[0];
  const dy = desired.position[1] - state.position[1];
  const distSq = dx * dx + dy * dy;
  return distSq <= distanceToleranceUm * distanceToleranceUm;
}

export interface CollisionGroundingResult {
  phase: "resolve_collisions_grounding";
  success: boolean;
  empty: boolean;
  records: unknown[];
}
export function resolveCollisionsGrounding(): CollisionGroundingResult {
  return { phase: "resolve_collisions_grounding", success: true, empty: true, records: [] };
}
