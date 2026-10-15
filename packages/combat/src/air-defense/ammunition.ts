// packages/combat/src/air-defense/ammunition.ts
// D-4 M4 Aviation: Air Defense — AC-13 ammunition consumption per DESIGN-45 §20.
// Every engagement MUST reserve and consume exact ammunition (§20 line 334). The basic
// model (spec §1.3 "full ammunition model ... deferred") tracks one rounds-remaining value
// per systemId in `state.ammunitionByType` (keyed by systemId — no ammo-type taxonomy in
// the definition yet; documented basic-model decision). An empty system contributes zero
// (§20 line 346); an absent entry models "present supply" (a defensive opportunity does not
// create ammunition, §20 line 346 — so consumption for an absent entry is a no-op on the
// map). Pure/deterministic: returns a new immutable state and recomputes the state hash
// (mirrors addDisruptionRecord); no ambient state is read.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { computeAirDefenseStateHash, type AirDefenseState } from "./air-defense-state.js";
import { INVALID_AIR_DEFENSE_STATE, OPERATIONAL_MULTIPLIER_BP } from "./constants.js";

/**
 * Rounds remaining for a system, or `undefined` when the system has no explicit
 * ammunition entry. Absent entry → supply is assumed present (documented basic model).
 */
export function roundsForSystem(state: AirDefenseState, systemId: string): SafeInt | undefined {
  return state.ammunitionByType.get(systemId);
}

/**
 * True when the system has ammunition available. Absent entry → assume present
 * (documented basic-model decision); explicit 0 → false (empty system contributes zero,
 * §20 line 346).
 */
export function hasAmmunition(state: AirDefenseState, systemId: string): boolean {
  const rounds = state.ammunitionByType.get(systemId);
  return rounds === undefined || rounds > 0;
}

/**
 * Ammunition multiplier factor (basis points) for the §19 formula. Basic model: an
 * explicit 0 → 0 (empty system contributes zero); every present supply is full → 10_000.
 */
export function ammunitionMultiplierBp(state: AirDefenseState, systemId: string): SafeInt {
  const rounds = state.ammunitionByType.get(systemId);
  if (rounds === undefined || rounds > 0) return SafeInt(OPERATIONAL_MULTIPLIER_BP);
  return SafeInt.ZERO;
}

/**
 * Consumes `rounds` (default: the system's `roundsPerEngagement`) for a system, returning a
 * new immutable state with a recomputed state hash.
 *
 * - Explicit entry: decremented by `rounds`. An insufficient explicit reserve
 *   (remaining < rounds) FAILS CLOSED with INVALID_AIR_DEFENSE_STATE
 *   ("consumeAmmunition: insufficient ammunition") — it never silently floors to 0: an
 *   engagement that cannot afford its exact ammunition MUST NOT fire (§20 line 334).
 * - Absent entry: modeled as present/full supply (documented basic model); a defensive
 *   opportunity does not create ammunition (§20 line 346), so the reserve stays absent
 *   and the map is unchanged. A new state is still returned (immutable) with the hash
 *   recomputed.
 */
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
    // Absent-entry no-op (see module doc). New immutable state + recomputed hash.
    const nextState: AirDefenseState = { ...state };
    nextState.stateHash = computeAirDefenseStateHash(nextState);
    return nextState;
  }

  if (Number(current) < Number(consume)) {
    // Fail-closed: an explicit reserve that cannot afford the exact engagement MUST NOT be
    // silently floored to 0 (§20 line 334: "Every engagement MUST reserve and consume exact
    // ammunition"; "Runtime inference and silent fallback behavior are prohibited").
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
