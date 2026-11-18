import type { DamageControlContext } from "../damage/damageControlEngineWiring.js";
import type { MovementState } from "../movement/index.js";
import { SPEED_BP_SCALE } from "../movement/neighbour.js";

export function withCurrentSpeeds(
  damageControl: Readonly<Record<string, DamageControlContext>> | undefined,
  movements: Readonly<Record<string, MovementState>>,
): Record<string, DamageControlContext> | undefined {
  if (!damageControl) return undefined;
  const next: Record<string, DamageControlContext> = {};
  for (const [shipId, context] of Object.entries(damageControl)) {
    const movement = movements[shipId];
    next[shipId] = movement
      ? { ...context, currentSpeedKt: Math.floor(movement.currentSpeed / SPEED_BP_SCALE) }
      : context;
  }
  return next;
}
