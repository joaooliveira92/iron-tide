import type { BattleMissionType } from "@bluewave/combat/generation";

export const OFFERED_MISSION_TYPES: readonly BattleMissionType[] = [
  "FLEET_BATTLE",
  "CRUISER_BATTLE",
];

export const ENCOUNTER_OFFERED_MISSION_TYPES: readonly BattleMissionType[] = [
  "RAIDER_INTERCEPTION",
  "BLOCKADE_BREAKOUT",
];

export function isOfferedMission(mission: string): boolean {
  return (
    OFFERED_MISSION_TYPES.some((offered) => offered === mission) ||
    ENCOUNTER_OFFERED_MISSION_TYPES.some((offered) => offered === mission)
  );
}
