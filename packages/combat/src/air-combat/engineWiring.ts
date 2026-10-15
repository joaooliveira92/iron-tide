//packages/combat/src/air-combat/engineWiring.ts
// D-3 M4 Aviation: CAP & Strikes — INC-8 (AC-16, AC-21).
// resolveAirCombat stage (step 1, substep 1) in the minute-advance pipeline.
// Runs after weather, before gunnery substep 2.
// Strict no-op when no CAP/strike aircraft present.
//
// Pure/deterministic: no ambient I/O/clock.
import { SafeInt } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";
import type { CapPatrolState } from "./cap-patrol.js";
import type { StrikeMissionState } from "./strike-state.js";
import { createAirCombatRecord, type AirCombatRecord } from "./records.js";
import { canonicallySortedRecords } from "./ordering.js";
import { AIR_COMBAT_RULESET_VERSION, AIR_COMBAT_ENGAGEMENT_SUBSTEP } from "./constants.js";

// ---------------------------------------------------------------------------
// Context and result types

export interface AirCombatContext {
  /** Battle identifier — used as record namespace */
  battleId: string;
  /** Current tactical minute */
  minute: number;
  /** CAP patrol states for all CAP-eligible squadrons in this battle */
  capPatrols?: CapPatrolState[];
  /** Strike mission states for all active strikes */
  strikeMissions?: StrikeMissionState[];
  /** Existing air-combat records from prior minutes (accumulated) */
  existingRecords?: AirCombatRecord[];
  /** Deterministic RNG engine for exchange draws (optional for INC-8 stub) */
  engine?: RandomEngine;
}

export interface AirCombatStageResult {
  /** Updated CAP patrol states (undefined === no change from input) */
  nextCapPatrols?: CapPatrolState[];
  /** Updated strike mission states (undefined === no change from input) */
  nextStrikeMissions?: StrikeMissionState[];
  /** Air-combat records emitted this minute */
  records: AirCombatRecord[];
  /** Whether any air-combat activity occurred this minute */
  active: boolean;
  /** Summary counters for the minute-hash snapshot surface */
  summary?: { capEngagements: number; strikeAttacks: number; losses: number };
}

// ---------------------------------------------------------------------------
// resolveAirCombat — per-minute air-combat stage

/**
 * Resolves the air-combat stage for one tactical minute.
 *
 * In INC-8, this is a **stage wiring stub** — it defines the interface,
 * proves strict no-op, and threads state. The full CAP/strike lifecycle
 * (detection, interception timing, exchange, bombing, torpedo, egress,
 * recovery) will land in a future increment that integrates battle-state
 * positions, squadron data, and carrier-recovery priority.
 *
 * For now, the function:
 *   1. Returns an empty result (strict no-op) when no CAP or strike
 *      missions are present → zero records, active=false.
 *   2. Creates one AirCombatRecord per active CAP engagement and per
 *      attacking strike.
 *   3. Threads input states through as next states (unchanged — the stub
 *      does not mutate state).
 *
 * @param context - Air-combat context for this minute.
 * @returns Stage result with records and states.
 */
export function resolveAirCombat(context: AirCombatContext): AirCombatStageResult {
  const { capPatrols, strikeMissions, battleId, minute } = context;

  // ---- Strict no-op: no CAP and no strikes → empty result ----
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

  // ENGAGEMENT records from CAP patrols in active interception/engagement
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

  // ATTACK records from strike missions in ATTACKING phase
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
    // Thread input states through as next states (unchanged in stub)
    nextCapPatrols: capPatrols ? [...capPatrols] : undefined,
    nextStrikeMissions: strikeMissions ? [...strikeMissions] : undefined,
    records: sorted,
    active: capEngagements > 0 || strikeAttacks > 0,
    summary: { capEngagements, strikeAttacks, losses },
  };
}
