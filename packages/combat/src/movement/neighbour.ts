export type { MovementState } from "./state.js";
export { DIRECTION_FIXED, KNOTS_TO_UM_S, SPEED_BP_SCALE } from "./constants.js";
export {
  advancePosition,
  directionBp,
  resolveCollisionsGrounding,
  resolvePropulsion,
  resolveTurning,
  speedBpKnotsToUmS,
} from "./kinematics.js";
