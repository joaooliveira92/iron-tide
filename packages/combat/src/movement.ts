import { BluewaveError } from "@bluewave/contracts";

export interface MovementState {
  position: [number, number];
  heading: number;
  orderedSpeed: number;
  currentSpeed: number;
  acceleration: number;
  turningRate: number;
  collisionRadius: number;
  propulsionState: string;
  machineryReliability: number;
  fuelState: string;
  formationStation: string;
  groundingState?: string;
  collisionState?: string;
}

export function assertFixedPointMovement(s: MovementState): void {
  const numeric: [string, number][] = [
    ["positionX", s.position[0]],
    ["positionY", s.position[1]],
    ["heading", s.heading],
    ["orderedSpeed", s.orderedSpeed],
    ["currentSpeed", s.currentSpeed],
    ["acceleration", s.acceleration],
    ["turningRate", s.turningRate],
    ["collisionRadius", s.collisionRadius],
  ];
  for (const [field, value] of numeric) {
    if (!Number.isInteger(value)) {
      throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
        code: "TACTICAL_STATE_INVARIANT_FAILED",
        field,
        reason: "fixed-point",
        value,
      });
    }
  }
  if (s.heading < 0 || s.heading > 359 || !Number.isInteger(s.heading)) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "heading",
      reason: "heading must be integer degrees in [0,359]",
      value: s.heading,
    });
  }
  if (s.orderedSpeed < 0 || s.currentSpeed < 0) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "speed",
      reason: "speed must be non-negative basis-point knots",
      value: { orderedSpeed: s.orderedSpeed, currentSpeed: s.currentSpeed },
    });
  }
  if (s.collisionRadius < 0) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "collisionRadius",
      reason: "collision radius must be non-negative micrometres",
      value: s.collisionRadius,
    });
  }
}
