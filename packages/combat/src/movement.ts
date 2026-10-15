//packages/combat/src/movement.ts
import { BluewaveError } from "@bluewave/contracts";

// DESIGN-38 §20 authoritative movement state. The numeric surface is integer
// fixed-point under DESIGN-07: position in integer micrometres, speeds in
// basis-point knots (knots * 1000), heading in integer degrees [0,359],
// acceleration in micrometres/s^2, turning rate in milli-degrees/s, collision
// radius in micrometres. The non-numeric enum/propulsion fields are excluded
// from the fixed-point invariant (AC-1).
export interface MovementState {
  position: [number, number]; // integer micrometres
  heading: number; // integer degrees 0..359
  orderedSpeed: number; // basis-point knots (knots * 1000), integer
  currentSpeed: number; // basis-point knots, integer
  acceleration: number; // integer micrometres/s^2 (thrust/brake acceleration)
  turningRate: number; // integer milli-degrees/s
  collisionRadius: number; // integer micrometres
  propulsionState: string;
  machineryReliability: number;
  fuelState: string;
  formationStation: string;
  groundingState?: string;
  collisionState?: string;
}

// AC-1: reject any non-integer in the numeric MovementState surface with
// TACTICAL_STATE_INVARIANT_FAILED. Reversible-to-invariant: a failure leaves the
// supplied state untouched (no partial mutation).
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
