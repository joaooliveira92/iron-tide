import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { computeAirDefenseStateHash, type AirDefenseState } from "./air-defense-state.js";
import { INVALID_AIR_DEFENSE_STATE, OPERATIONAL_MULTIPLIER_BP } from "./constants.js";

export function roundsForSystem(state: AirDefenseState, systemId: string): SafeInt | undefined {
  return state.ammunitionByType.get(systemId);
}

export function hasAmmunition(state: AirDefenseState, systemId: string): boolean {
  const rounds = state.ammunitionByType.get(systemId);
  return rounds === undefined || rounds > 0;
}

export function ammunitionMultiplierBp(state: AirDefenseState, systemId: string): SafeInt {
  const rounds = state.ammunitionByType.get(systemId);
  if (rounds === undefined || rounds > 0) return SafeInt(OPERATIONAL_MULTIPLIER_BP);
  return SafeInt.ZERO;
}

export function consumeAmmunition(
  state: AirDefenseState,
  systemId: string,
  rounds?: SafeInt,
): AirDefenseState {
  const consume =
    rounds ??
    state.systems.find((sys) => sys.systemId === systemId)?.roundsPerEngagement ??
    SafeInt.ONE;
  if (!SafeInt.isSafeInt(consume) || consume < 0) {
    throw new BluewaveError("consumeAmmunition: rounds must be a non-negative safe integer", {
      code: INVALID_AIR_DEFENSE_STATE,
      systemId,
      rounds: consume,
    });
  }

  const current = state.ammunitionByType.get(systemId);
  if (current === undefined) {
    const nextState: AirDefenseState = { ...state };
    nextState.stateHash = computeAirDefenseStateHash(nextState);
    return nextState;
  }

  if (Number(current) < Number(consume)) {
    throw new BluewaveError("consumeAmmunition: insufficient ammunition", {
      code: INVALID_AIR_DEFENSE_STATE,
      systemId,
      remaining: current,
      rounds: consume,
    });
  }

  const remaining = Number(current) - Number(consume);
  const nextAmmunition = new Map(state.ammunitionByType);
  nextAmmunition.set(systemId, SafeInt(remaining));

  const nextState: AirDefenseState = { ...state, ammunitionByType: nextAmmunition };
  nextState.stateHash = computeAirDefenseStateHash(nextState);
  return nextState;
}
