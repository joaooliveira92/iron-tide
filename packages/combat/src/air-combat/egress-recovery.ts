import { SafeInt } from "@bluewave/contracts";
import {
  AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT,
  AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE,
} from "./reasonCodes.js";
import {
  transitionStrikeState,
  computeStrikeStateHash,
  type StrikeMissionState,
} from "./strike-state.js";

export interface FuelCheckResult {
  sufficient: boolean;
  reasonCode: string | null;
}

export interface RecoveryCheckResult {
  available: boolean;
  reasonCode: string | null;
  lossRiskBp: SafeInt;
}

export function checkStrikeFuel(state: StrikeMissionState): FuelCheckResult {
  const fuelRemaining = Number(state.fuelRemainingMinutes);

  if (fuelRemaining < 1) {
    return {
      sufficient: false,
      reasonCode: AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT,
    };
  }

  return {
    sufficient: true,
    reasonCode: null,
  };
}

export function computeEgressPosition(state: StrikeMissionState): [number, number] {
  const [currentX, currentY] = state.position;
  const [startX, startY] = state.startPosition;

  const speedMps = Number(state.speedMps);
  const distanceThisMinute = speedMps * 60;

  const dx = startX - currentX;
  const dy = startY - currentY;

  const distToStart = Math.sqrt(dx * dx + dy * dy);

  if (distToStart <= 0) {
    return [startX, startY];
  }

  if (distanceThisMinute >= distToStart) {
    return [startX, startY];
  }

  const ratio = distanceThisMinute / distToStart;
  const newX = currentX + dx * ratio;
  const newY = currentY + dy * ratio;

  return [newX, newY];
}

export function createEgressState(state: StrikeMissionState): StrikeMissionState {
  const egressPosition = computeEgressPosition(state);
  const newFuel = SafeInt.sub(state.fuelRemainingMinutes, SafeInt.ONE);

  const egressState = transitionStrikeState(state, "EGRESSING", {
    position: egressPosition,
  });

  const updated: StrikeMissionState = {
    ...egressState,
    fuelRemainingMinutes: newFuel,
  };
  updated.stateHash = computeStrikeStateHash(updated);
  return updated;
}

export function checkRecoveryAvailability(
  deckState: string,
  weather: string,
  isNight: boolean,
): RecoveryCheckResult {
  if (deckState !== "AVAILABLE") {
    return {
      available: false,
      reasonCode: AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE,
      lossRiskBp: SafeInt.ZERO,
    };
  }

  let lossRiskBp = 500;

  if (isNight) {
    lossRiskBp += 2000;
  }

  if (weather === "STORM") {
    lossRiskBp += 1500;
  }

  return {
    available: true,
    reasonCode: null,
    lossRiskBp: SafeInt(lossRiskBp),
  };
}

export function computeReturnToBase(state: StrikeMissionState): StrikeMissionState {
  const [currentX, currentY] = state.position;
  const [startX, startY] = state.startPosition;

  const speedMps = Number(state.speedMps);
  const distanceThisMinute = speedMps * 60;

  const dx = startX - currentX;
  const dy = startY - currentY;

  const distToStart = Math.sqrt(dx * dx + dy * dy);

  let newPosition: [number, number];

  const EPSILON = 100;

  if (distToStart <= EPSILON || distanceThisMinute >= distToStart) {
    newPosition = [startX, startY];
  } else {
    const ratio = distanceThisMinute / distToStart;
    newPosition = [currentX + dx * ratio, currentY + dy * ratio];
  }

  const updated: StrikeMissionState = {
    ...state,
    position: newPosition,
    fuelRemainingMinutes: SafeInt.sub(state.fuelRemainingMinutes, SafeInt.ONE),
  };
  updated.stateHash = computeStrikeStateHash(updated);
  return updated;
}
