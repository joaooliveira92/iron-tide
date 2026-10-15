//packages/combat/src/air-combat/egress-recovery.ts
// D-3 M4 Aviation: CAP & Strikes — INC-6 (AC-14, AC-15): strike egress, fuel check, and recovery.
// Pure deterministic functions — no I/O, no Date.
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

// ---- FuelCheckResult ----

export interface FuelCheckResult {
  sufficient: boolean;
  reasonCode: string | null;
}

// ---- RecoveryCheckResult ----

export interface RecoveryCheckResult {
  available: boolean;
  reasonCode: string | null;
  lossRiskBp: SafeInt;
}

// ---- checkStrikeFuel ----

/**
 * Checks whether a strike formation has sufficient fuel to continue.
 *
 * fuelRemainingMinutes >= 1 → sufficient
 * fuelRemainingMinutes < 1 → insufficient → AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT
 *
 * @param state - The current strike mission state.
 * @returns FuelCheckResult with sufficiency status.
 */
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

// ---- computeEgressPosition ----

/**
 * Computes the egress position moving toward the start position (base/carrier).
 *
 * newPosition = move state.position towards state.startPosition by state.speedMps * 60 meters.
 * Simple linear interpolation along each axis.
 *
 * @param state - The current strike mission state.
 * @returns The new [x, y] position (does not overshoot startPosition).
 */
export function computeEgressPosition(state: StrikeMissionState): [number, number] {
  const [currentX, currentY] = state.position;
  const [startX, startY] = state.startPosition;

  const speedMps = Number(state.speedMps);
  const distanceThisMinute = speedMps * 60; // meters per minute

  // Vector from current position toward start position
  const dx = startX - currentX;
  const dy = startY - currentY;

  // Distance to start
  const distToStart = Math.sqrt(dx * dx + dy * dy);

  if (distToStart <= 0) {
    // Already at start position
    return [startX, startY];
  }

  if (distanceThisMinute >= distToStart) {
    // Will reach or overshoot — clamp to start position
    return [startX, startY];
  }

  // Move toward start by distanceThisMinute
  const ratio = distanceThisMinute / distToStart;
  const newX = currentX + dx * ratio;
  const newY = currentY + dy * ratio;

  return [newX, newY];
}

// ---- createEgressState ----

/**
 * Creates a new state transitioning the strike to egress.
 *
 * Transitions phase to EGRESSING, updates position toward start,
 * decrements fuelRemainingMinutes by 1.
 *
 * @param state - The current strike mission state (must be in ATTACKING phase).
 * @returns A new StrikeMissionState in EGRESSING phase.
 */
export function createEgressState(state: StrikeMissionState): StrikeMissionState {
  const egressPosition = computeEgressPosition(state);
  const newFuel = SafeInt.sub(state.fuelRemainingMinutes, SafeInt.ONE);

  const egressState = transitionStrikeState(state, "EGRESSING", {
    position: egressPosition,
  });

  // Manually update fuel (transitionStrikeState doesn't handle fuel)
  const updated: StrikeMissionState = {
    ...egressState,
    fuelRemainingMinutes: newFuel,
  };
  updated.stateHash = computeStrikeStateHash(updated);
  return updated;
}

// ---- checkRecoveryAvailability ----

/**
 * Checks whether a recovery deck (carrier or airfield) is available for landing.
 *
 * Recovery loss risk (bp):
 * - Normal day: 500bp = 5%
 * - Night recovery: 2000bp = 20%
 * - Bad weather: 1500bp = 15%
 * - Night + bad weather: 2000 + 1500 = 3500bp (cumulative)
 *
 * @param deckState - State of the recovery deck ("AVAILABLE" | "DAMAGED" | "DECK_PARKED_FULL").
 * @param weather - Weather condition ("CLEAR" | "CLOUDS" | "STORM").
 * @param isNight - Whether it is night time.
 * @returns RecoveryCheckResult with availability and loss risk.
 */
export function checkRecoveryAvailability(
  deckState: string,
  weather: string,
  isNight: boolean,
): RecoveryCheckResult {
  // Deck availability check
  if (deckState !== "AVAILABLE") {
    return {
      available: false,
      reasonCode: AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE,
      lossRiskBp: SafeInt.ZERO,
    };
  }

  // Compute loss risk
  let lossRiskBp = 500; // base day recovery risk

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

// ---- computeReturnToBase ----

/**
 * Moves a RETURNING aircraft toward its base (start position).
 *
 * Same movement logic as egress (linear interpolation).
 * If position reaches startPosition (within epsilon of 100m),
 * the aircraft has recovered and position is clamped.
 *
 * @param state - The current strike mission state (must be in RETURNING phase).
 * @returns A new StrikeMissionState with updated position.
 */
export function computeReturnToBase(state: StrikeMissionState): StrikeMissionState {
  const [currentX, currentY] = state.position;
  const [startX, startY] = state.startPosition;

  const speedMps = Number(state.speedMps);
  const distanceThisMinute = speedMps * 60; // meters per minute

  // Vector from current position toward start position
  const dx = startX - currentX;
  const dy = startY - currentY;

  // Distance to start
  const distToStart = Math.sqrt(dx * dx + dy * dy);

  let newPosition: [number, number];

  const EPSILON = 100; // meters — within this distance, consider recovered

  if (distToStart <= EPSILON || distanceThisMinute >= distToStart) {
    // Recovered — clamp to start position
    newPosition = [startX, startY];
  } else {
    // Move toward start by distanceThisMinute
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
