//packages/combat/src/air-combat/strike-state.ts
// D-3 M4 Aviation: CAP & Strikes — INC-3 (AC-8): strike mission tactical state machine.
// Pure deterministic functions — no I/O, no random, no Date.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { AIR_COMBAT_RULESET_VERSION } from "./constants.js";
import { AIR_COMBAT_INVALID_STRIKE_TRANSITION } from "./reasonCodes.js";

// ---- StrikeMissionPhase ----

export type StrikeMissionPhase = "EN_ROUTE" | "ON_TARGET" | "ATTACKING" | "EGRESSING" | "RETURNING";

// ---- StrikeMissionState ----

export interface StrikeMissionState {
  missionId: string;
  strikeId: string;
  phase: StrikeMissionPhase;
  squadronIds: string[];
  targetId: string;
  position: [number, number];
  startPosition: [number, number];
  speedMps: SafeInt;
  altitude: "HIGH" | "MEDIUM" | "LOW";
  fuelRemainingMinutes: SafeInt;
  disruptionBp: SafeInt;
  attackCount: SafeInt;
  isFirstPass: boolean;
  stateHash: string;
}

// ---- STRIKE_MISSION_TRANSITIONS ----

export const STRIKE_MISSION_TRANSITIONS: Record<StrikeMissionPhase, StrikeMissionPhase[]> = {
  EN_ROUTE: ["ON_TARGET"],
  ON_TARGET: ["ATTACKING"],
  ATTACKING: ["EGRESSING", "ON_TARGET"],
  EGRESSING: ["RETURNING"],
  RETURNING: [],
};

// ---- validateStrikeTransition ----

/**
 * Validates that a strike mission state transition is allowed.
 *
 * @param current - The current phase.
 * @param next - The desired next phase.
 * @param missionId - The mission identifier (for error context).
 * @throws BluewaveError with AIR_COMBAT_INVALID_STRIKE_TRANSITION if transition is invalid.
 */
export function validateStrikeTransition(
  current: StrikeMissionPhase,
  next: StrikeMissionPhase,
  missionId?: string,
): void {
  if (typeof current !== "string" || current.length === 0) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STRIKE_TRANSITION, {
      code: AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      current,
      next,
      missionId: missionId ?? "(unknown)",
      reason: "current phase must be a non-empty string",
    });
  }

  if (typeof next !== "string" || next.length === 0) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STRIKE_TRANSITION, {
      code: AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      current,
      next,
      missionId: missionId ?? "(unknown)",
      reason: "next phase must be a non-empty string",
    });
  }

  const allowed = STRIKE_MISSION_TRANSITIONS[current];

  if (!allowed) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STRIKE_TRANSITION, {
      code: AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      current,
      next,
      missionId: missionId ?? "(unknown)",
      reason: `unknown current phase "${current}"`,
    });
  }

  if (!allowed.includes(next)) {
    throw new BluewaveError(AIR_COMBAT_INVALID_STRIKE_TRANSITION, {
      code: AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      current,
      next,
      missionId: missionId ?? "(unknown)",
      reason: `invalid transition from "${current}" to "${next}"`,
    });
  }
}

// ---- createStrikeMissionState ----

/**
 * Creates a new strike mission state with initial defaults.
 *
 * @param missionId - Unique identifier for the mission.
 * @param strikeId - Unique identifier for the strike formation.
 * @param squadronIds - List of squadron identifiers in the strike.
 * @param targetId - Target ship unit ID.
 * @param launchPosition - [x, y] launch position.
 * @param speedMps - Formation speed in meters per second (slowest aircraft).
 * @param fuelRemainingMinutes - Fuel remaining in minutes.
 * @returns A valid initial StrikeMissionState.
 */
export function createStrikeMissionState(
  missionId: string,
  strikeId: string,
  squadronIds: string[],
  targetId: string,
  launchPosition: [number, number],
  speedMps: SafeInt,
  fuelRemainingMinutes: SafeInt,
): StrikeMissionState {
  const state: StrikeMissionState = {
    missionId,
    strikeId,
    phase: "EN_ROUTE",
    squadronIds,
    targetId,
    position: launchPosition,
    startPosition: launchPosition,
    speedMps,
    altitude: "MEDIUM",
    fuelRemainingMinutes,
    disruptionBp: SafeInt(10_000),
    attackCount: SafeInt.ZERO,
    isFirstPass: true,
    stateHash: "",
  };

  state.stateHash = computeStrikeStateHash(state);
  return state;
}

// ---- computeStrikeStateHash ----

/**
 * Computes a deterministic hash for a StrikeMissionState.
 * Excludes the stateHash field itself from the hash computation.
 *
 * @param state - The strike mission state to hash.
 * @returns Hex-encoded SHA-256 hash string.
 */
export function computeStrikeStateHash(state: StrikeMissionState): string {
  const { stateHash: _sh, ...rest } = state;
  const envelope = createEnvelope("strike-mission-state", AIR_COMBAT_RULESET_VERSION, rest);
  return envelope.bodyHash;
}

// ---- TransitionStateParams ----

export interface TransitionStateParams {
  position?: [number, number];
  disruptionBp?: SafeInt;
}

// ---- transitionStrikeState ----

/**
 * Transitions a strike mission state to a new phase, validating the transition.
 * Returns a new state object without mutating the input.
 *
 * @param state - The current strike mission state.
 * @param nextPhase - The desired next phase.
 * @param params - Optional overrides (position, disruptionBp).
 * @returns A new StrikeMissionState with the updated phase and computed hash.
 * @throws BluewaveError with AIR_COMBAT_INVALID_STRIKE_TRANSITION if transition is invalid.
 */
export function transitionStrikeState(
  state: StrikeMissionState,
  nextPhase: StrikeMissionPhase,
  params?: TransitionStateParams,
): StrikeMissionState {
  validateStrikeTransition(state.phase, nextPhase, state.missionId);

  // Shallow copy ensures we don't mutate the input
  const newState: StrikeMissionState = {
    ...state,
    phase: nextPhase,
  };

  // When leaving ATTACKING back to ON_TARGET, increment attack count
  if (state.phase === "ATTACKING" && nextPhase === "ON_TARGET") {
    newState.attackCount = SafeInt.add(state.attackCount, SafeInt.ONE);
  }

  // After any attack transition (leaving ATTACKING), subsequent attacks are not first passes
  if (state.phase === "ATTACKING") {
    newState.isFirstPass = false;
  }

  // Position override if provided
  if (params?.position) {
    newState.position = params.position;
  }

  // Disruption override if provided
  if (params?.disruptionBp !== undefined) {
    newState.disruptionBp = params.disruptionBp;
  }

  // Compute new state hash
  newState.stateHash = computeStrikeStateHash(newState);

  return newState;
}
