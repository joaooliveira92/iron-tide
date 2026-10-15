import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_SIDE_INVALID } from "./reasonCodes.js";
import type { TacticalSideRecord } from "../tactical/state.js";

export function determineParticipatingSides(
  attackerNationalNationId: string,
  defenderNationalNationId: string,
  attackerParticipants: string[],
  defenderParticipants: string[],
  context?: Record<string, unknown>,
): TacticalSideRecord[] {
  const attacker = {
    sideId: "ATTACKER" as const,
    participantIds: [...attackerParticipants, attackerNationalNationId],
  };
  const defender = {
    sideId: "DEFENDER" as const,
    participantIds: [...defenderParticipants, defenderNationalNationId],
  };

  const all = new Set([...attacker.participantIds, ...defender.participantIds]);
  if (all.size !== attacker.participantIds.length + defender.participantIds.length) {
    throw new BluewaveError(BATTLE_SIDE_INVALID, {
      code: BATTLE_SIDE_INVALID,
      reason: "overlapping participants across sides",
      ...context,
    });
  }
  if (attacker.participantIds.length === 0 || defender.participantIds.length === 0) {
    throw new BluewaveError(BATTLE_SIDE_INVALID, {
      code: BATTLE_SIDE_INVALID,
      reason: "each side must have at least the core participant",
      ...context,
    });
  }
  return [attacker, defender];
}
