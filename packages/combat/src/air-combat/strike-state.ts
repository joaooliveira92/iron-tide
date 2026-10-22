import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { AIR_COMBAT_RULESET_VERSION } from "./constants.js";
import { AIR_COMBAT_INVALID_STRIKE_TRANSITION } from "./reasonCodes.js";

export type StrikeMissionPhase = "EN_ROUTE" | "ON_TARGET" | "ATTACKING" | "EGRESSING" | "RETURNING";

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

export const STRIKE_MISSION_TRANSITIONS: Record<StrikeMissionPhase, StrikeMissionPhase[]> = {
  EN_ROUTE: ["ON_TARGET"],
  ON_TARGET: ["ATTACKING"],
  ATTACKING: ["EGRESSING", "ON_TARGET"],
  EGRESSING: ["RETURNING"],
  RETURNING: [],
};

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

export function computeStrikeStateHash(state: StrikeMissionState): string {
  const { stateHash: _sh, ...rest } = state;
  const envelope = createEnvelope("strike-mission-state", AIR_COMBAT_RULESET_VERSION, rest);
  return envelope.bodyHash;
}

export interface TransitionStateParams {
  position?: [number, number];
  disruptionBp?: SafeInt;
}

export function transitionStrikeState(
  state: StrikeMissionState,
  nextPhase: StrikeMissionPhase,
  params?: TransitionStateParams,
): StrikeMissionState {
  validateStrikeTransition(state.phase, nextPhase, state.missionId);

  const newState: StrikeMissionState = {
    ...state,
    phase: nextPhase,
  };

  if (state.phase === "ATTACKING" && nextPhase === "ON_TARGET") {
    newState.attackCount = SafeInt.add(state.attackCount, SafeInt.ONE);
  }

  if (state.phase === "ATTACKING") {
    newState.isFirstPass = false;
  }

  if (params?.position) {
    newState.position = params.position;
  }

  if (params?.disruptionBp !== undefined) {
    newState.disruptionBp = params.disruptionBp;
  }

  newState.stateHash = computeStrikeStateHash(newState);

  return newState;
}
