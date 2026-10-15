import { BluewaveError } from "@bluewave/contracts";
import { type LandTargetDamageState, type DamageEventType } from "./constants.js";
import { INVALID_DAMAGE_STATE_TRANSITION } from "./reasonCodes.js";

const DAMAGE_PROGRESSION: Record<LandTargetDamageState, LandTargetDamageState | null> = {
  INTACT: "SUPPRESSED",
  SUPPRESSED: "DAMAGED",
  DAMAGED: "DISABLED",
  DISABLED: "DESTROYED",
  DESTROYED: null,
};

export function applyLandTargetDamage(
  currentState: LandTargetDamageState,
  _eventType: DamageEventType,
): LandTargetDamageState {
  const next = DAMAGE_PROGRESSION[currentState];
  if (next === null) {
    throw new BluewaveError(INVALID_DAMAGE_STATE_TRANSITION, {
      code: INVALID_DAMAGE_STATE_TRANSITION,
      currentState,
      reason: `${currentState} is terminal — no further damage possible`,
    });
  }
  return next;
}

export function canDamage(currentState: LandTargetDamageState): boolean {
  return currentState !== "DESTROYED";
}
