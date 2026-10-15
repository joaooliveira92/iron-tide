import { BluewaveError } from "@bluewave/contracts";
import { type DeckCycleState } from "./constants.js";
import { INVALID_CARRIER_DECK_CYCLE_TRANSITION } from "./reasonCodes.js";

const VALID_TRANSITIONS: Record<DeckCycleState, readonly DeckCycleState[]> = {
  UNREADY: ["READYING"],
  READYING: ["SPOTTING", "UNREADY"],
  SPOTTING: ["SPOTTED", "READYING"],
  SPOTTED: ["LAUNCHING", "READYING"],
  LAUNCHING: ["FORMING", "AIRBORNE"],
  FORMING: ["AIRBORNE", "LAUNCHING"],
  AIRBORNE: ["RETURNING", "LANDING"],
  RETURNING: ["HOLDING", "LANDING"],
  HOLDING: ["LANDING", "AIRBORNE"],
  LANDING: ["REFUELING", "REARMING", "AIRBORNE"],
  REFUELING: ["REARMING", "STRUCK_DOWN", "LAUNCHING", "UNREADY"],
  REARMING: ["STRUCK_DOWN", "LAUNCHING", "UNREADY"],
  STRUCK_DOWN: ["UNREADY"],
};

export function isValidDeckCycleTransition(from: DeckCycleState, to: DeckCycleState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

export function assertValidDeckCycleTransition(from: DeckCycleState, to: DeckCycleState): void {
  if (!isValidDeckCycleTransition(from, to)) {
    throw new BluewaveError(INVALID_CARRIER_DECK_CYCLE_TRANSITION, {
      code: INVALID_CARRIER_DECK_CYCLE_TRANSITION,
      field: "deckCycleState",
      reason: `invalid transition from ${from} to ${to}`,
      value: { from, to },
    });
  }
}
