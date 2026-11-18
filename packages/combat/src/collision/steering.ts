import { advancePosition } from "../movement/kinematics.js";
import type { MovementState } from "../movement/state.js";
import { segmentCrossesLand, type TerrainView } from "../terrain/index.js";

export const LAND_LOOKAHEAD_SECONDS = 60 as const;

export interface SteerClearOfLandInput {
  readonly terrain: TerrainView;
  readonly position: readonly [number, number];
  readonly heading: number;
  readonly speedBp: number;
}

function fold(degrees: number): number {
  return (((degrees % 360) + 360) % 360) | 0;
}

function crossesAhead(input: SteerClearOfLandInput, heading: number): boolean {
  const state: MovementState = {
    position: [input.position[0], input.position[1]],
    heading,
    orderedSpeed: input.speedBp,
    currentSpeed: input.speedBp,
    acceleration: 0,
    turningRate: 0,
    collisionRadius: 0,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
  };
  const to = advancePosition({ state, dtSeconds: LAND_LOOKAHEAD_SECONDS });
  return segmentCrossesLand(input.terrain, [input.position[0], input.position[1]], to);
}

export function steerClearOfLand(input: SteerClearOfLandInput): number {
  const heading = fold(input.heading);
  if (input.speedBp <= 0 || input.terrain.land.length === 0) return heading;
  if (!crossesAhead(input, heading)) return heading;
  for (let delta = 1; delta <= 180; delta += 1) {
    const up = fold(heading + delta);
    if (!crossesAhead(input, up)) return up;
    const down = fold(heading - delta);
    if (!crossesAhead(input, down)) return down;
  }
  return heading;
}
