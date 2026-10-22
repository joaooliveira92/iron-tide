import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { AIRCRAFT_RULESET_VERSION, type AircraftType } from "./constants.js";
import type { SquadronState } from "./state.js";
import { INVALID_AIRCRAFT_STATE } from "./reasonCodes.js";

export const SQUADRON_EXPERIENCE_MIN = 0 as const;
export const SQUADRON_EXPERIENCE_MAX = 100 as const;

export function assertSquadronExperience(value: SafeInt): void {
  const n = Number(value);
  if (n < SQUADRON_EXPERIENCE_MIN || n > SQUADRON_EXPERIENCE_MAX) {
    throw new BluewaveError(INVALID_AIRCRAFT_STATE, {
      code: INVALID_AIRCRAFT_STATE,
      field: "squadronExperience",
      value: n,
      reason: `experience must be ${SQUADRON_EXPERIENCE_MIN}..${SQUADRON_EXPERIENCE_MAX}`,
    });
  }
}

export function createSquadronState(
  squadronId: string,
  ownerNationId: string,
  role: AircraftType,
  authorizedStrength: SafeInt,
  baseOrCarrierId: string,
): SquadronState {
  return {
    squadronId,
    ownerNationId,
    squadronRole: role,
    assignedModelId: null,
    authorizedStrength,
    operationalAircraftCount: SafeInt.ZERO,
    damagedAircraftCount: SafeInt.ZERO,
    replacementAircraftReserved: SafeInt.ZERO,
    pilotCount: SafeInt.ZERO,
    squadronExperience: SafeInt(50),
    fatigue: SafeInt.ZERO,
    trainingState: "NORMAL",
    baseOrCarrierId,
    reequipmentState: "NONE",
    expansionState: "NONE",
    missionAvailability: [],
    rulesetVersion: AIRCRAFT_RULESET_VERSION,
    stateHash: "",
  };
}

export function computeSquadronStateHash(squadron: SquadronState): string {
  const { stateHash: _sh, ...rest } = squadron;
  const envelope = createEnvelope("squadron-state", AIRCRAFT_RULESET_VERSION, rest);
  return envelope.bodyHash;
}

export function withSquadronStateHash(squadron: SquadronState): SquadronState {
  return { ...squadron, stateHash: computeSquadronStateHash(squadron) };
}
