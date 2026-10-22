import { SafeInt } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";
import type { CapPatrolState } from "./cap-patrol.js";
import type { StrikeMissionState } from "./strike-state.js";
import { createAirCombatRecord, type AirCombatRecord } from "./records.js";
import { canonicallySortedRecords } from "./ordering.js";
import { AIR_COMBAT_RULESET_VERSION, AIR_COMBAT_ENGAGEMENT_SUBSTEP } from "./constants.js";

export interface AirCombatContext {
  battleId: string;
  minute: number;
  capPatrols?: CapPatrolState[];
  strikeMissions?: StrikeMissionState[];
  existingRecords?: AirCombatRecord[];
  engine?: RandomEngine;
}

export interface AirCombatStageResult {
  nextCapPatrols?: CapPatrolState[];
  nextStrikeMissions?: StrikeMissionState[];
  records: AirCombatRecord[];
  active: boolean;
  summary?: { capEngagements: number; strikeAttacks: number; losses: number };
}

export function resolveAirCombat(context: AirCombatContext): AirCombatStageResult {
  const { capPatrols, strikeMissions, battleId, minute } = context;

  if (
    (!capPatrols || capPatrols.length === 0) &&
    (!strikeMissions || strikeMissions.length === 0)
  ) {
    return { records: [], active: false };
  }

  const records: AirCombatRecord[] = [];
  let capEngagements = 0;
  let strikeAttacks = 0;
  let losses = 0;

  if (capPatrols) {
    for (const cp of capPatrols) {
      if (cp.engagementState === "INTERCEPTING" || cp.engagementState === "ENGAGING") {
        capEngagements++;
        records.push(
          createAirCombatRecord({
            recordId: `${battleId}:${minute}:${AIR_COMBAT_ENGAGEMENT_SUBSTEP}:cap:${cp.squadronId}`,
            battleId,
            minute: SafeInt(minute),
            substep: SafeInt(AIR_COMBAT_ENGAGEMENT_SUBSTEP),
            recordKind: "ENGAGEMENT",
            actorId: cp.squadronId,
            targetId: cp.interceptTargetId,
            description: `CAP ${cp.engagementState.toLowerCase()} at minute ${minute}`,
            reasonCode: "AIR_COMBAT_STAGE_ACTIVE",
            rulesetVersion: AIR_COMBAT_RULESET_VERSION,
          }),
        );
      }
    }
  }

  if (strikeMissions) {
    for (const sm of strikeMissions) {
      if (sm.phase === "ATTACKING") {
        strikeAttacks++;
        records.push(
          createAirCombatRecord({
            recordId: `${battleId}:${minute}:${AIR_COMBAT_ENGAGEMENT_SUBSTEP}:strike:${sm.missionId}`,
            battleId,
            minute: SafeInt(minute),
            substep: SafeInt(AIR_COMBAT_ENGAGEMENT_SUBSTEP),
            recordKind: "ATTACK",
            actorId: sm.missionId,
            targetId: sm.targetId,
            description: `Strike attacking target ${sm.targetId} at minute ${minute}`,
            reasonCode: "AIR_COMBAT_STAGE_ACTIVE",
            rulesetVersion: AIR_COMBAT_RULESET_VERSION,
          }),
        );
      }
    }
  }

  const sorted = canonicallySortedRecords([...(context.existingRecords ?? []), ...records]);

  return {
    nextCapPatrols: capPatrols ? [...capPatrols] : undefined,
    nextStrikeMissions: strikeMissions ? [...strikeMissions] : undefined,
    records: sorted,
    active: capEngagements > 0 || strikeAttacks > 0,
    summary: { capEngagements, strikeAttacks, losses },
  };
}
