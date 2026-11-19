import { advancePosition } from "../movement/kinematics.js";
import type { MovementState } from "../movement/state.js";
import { segmentCrossesLand, type TerrainView } from "../terrain/index.js";
import { segmentCrossesMinefield, type KnownMinefieldView } from "./minefields.js";

export const LAND_LOOKAHEAD_SECONDS = 60 as const;

export interface SteerClearOfHazardsInput {
  readonly terrain?: TerrainView;
  readonly minefields?: KnownMinefieldView;
  readonly position: readonly [number, number];
  readonly heading: number;
  readonly speedBp: number;
}

export interface SteerClearOfLandInput extends SteerClearOfHazardsInput {
  readonly terrain: TerrainView;
}

function fold(degrees: number): number {
  return (((degrees % 360) + 360) % 360) | 0;
}

function hazardous(input: SteerClearOfHazardsInput, heading: number): boolean {
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
  const from: [number, number] = [input.position[0], input.position[1]];
  if (input.terrain && segmentCrossesLand(input.terrain, from, to)) return true;
  return input.minefields !== undefined && segmentCrossesMinefield(input.minefields, from, to);
}

export function steerClearOfHazards(input: SteerClearOfHazardsInput): number {
  const heading = fold(input.heading);
  const hasHazards =
    (input.terrain?.land.length ?? 0) > 0 || (input.minefields?.minefields.length ?? 0) > 0;
  if (input.speedBp <= 0 || !hasHazards) return heading;
  if (!hazardous(input, heading)) return heading;
  for (let delta = 1; delta <= 180; delta += 1) {
    const up = fold(heading + delta);
    if (!hazardous(input, up)) return up;
    const down = fold(heading - delta);
    if (!hazardous(input, down)) return down;
  }
  return heading;
}

export function steerClearOfLand(input: SteerClearOfLandInput): number {
  return steerClearOfHazards(input);
}
