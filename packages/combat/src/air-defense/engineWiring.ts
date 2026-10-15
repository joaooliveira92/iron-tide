// packages/combat/src/air-defense/engineWiring.ts
// D-4 M4 Aviation: Air Defense — INC-6 (AC-18).
// resolveAirDefense stage (step 7.8) in the minute-advance pipeline: after air combat
// (7.7), before sensors/spotting (8). Strict no-op when no defender or no attack is present.
//
// Composition (ADR-0042 decision 21):
//   - defenders in codepoint defenderId order; per defender, resolveDefenseLayers runs the
//     §1 layer order (HEAVY → MEDIUM → LIGHT → CIWS) with systems in codepoint systemId order;
//   - every ELIGIBLE (system, attack) candidate resolves one keyed engagement
//     (resolveEngagement) and the defender state (ammunition) threads to the next candidate;
//   - every INELIGIBLE candidate with a §28 reason emits an INELIGIBLE record (no draw);
//   - §19 multipliers: director = directorState.scalingBp, radar =
//     radarState.diminishingReturnsBp, crew = state.crewQuality, saturation = the §16 CIWS
//     factor over the layer's eligible CIWS count (neutral elsewhere); targetProfile/weather
//     are caller-supplied (neutral default). ammunition/damage are state-authoritative
//     inside resolveEngagement.
//
// Pure/deterministic: no ambient I/O/clock; every random decision is keyed by
// airDefenseEngagementStreamId.
import { SafeInt } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseState } from "./air-defense-state.js";
import type { AirDefenseOperability } from "./eligibility.js";
import { lightAaProfileForAttack } from "./eligibility.js";
import { resolveDefenseLayers } from "./layer-resolution.js";
import { resolveEngagement, type EngagementMultipliers } from "./engagement.js";
import { ammunitionMultiplierBp, roundsForSystem } from "./ammunition.js";
import { computeCiwsSaturationFactorBp } from "./ciws-redundancy.js";
import {
  airDefenseOutcomeOrdinal,
  createAirDefenseEngagementRecord,
  type AirDefenseEngagementRecord,
  type AirDefenseRecordOutcome,
} from "./records.js";
import { canonicallySortedAirDefenseRecords } from "./ordering.js";
import { AIR_DEFENSE_FORMULA_VERSION, AIR_DEFENSE_MODEL_VERSION } from "./constants.js";
import { AIR_ATTACK_ABORTED, AIR_ATTACK_DISRUPTED } from "./reasonCodes.js";

/** Substep at which the air-defense stage resolves (mirrors AIR_COMBAT_ENGAGEMENT_SUBSTEP). */
export const AIR_DEFENSE_ENGAGEMENT_SUBSTEP = 1 as const;

const NEUTRAL_BP = SafeInt(10_000);

// ---------------------------------------------------------------------------
// Context and result types

export interface AirDefenseDefenderContext {
  /** Authoritative per-defender air-defense state (systems, ammunition, director/radar). */
  state: AirDefenseState;
  operability: AirDefenseOperability;
  directorAvailable: boolean;
  radarAvailable: boolean;
  /** attacked ship id → distance from this defender (heavy-AA protected radius, §10). */
  protectedShipDistanceM?: ReadonlyMap<string, SafeInt>;
  /** systemId → engagement channel free. Absent → channel free. */
  channelAvailableBySystem?: ReadonlyMap<string, boolean>;
  /** §19 target-profile factor (bp). Absent → neutral 10_000. */
  targetProfileBp?: SafeInt;
  /** §19 weather factor (bp). Absent → neutral 10_000. */
  weatherBp?: SafeInt;
}

export interface AirDefenseContext {
  defenders: ReadonlyArray<AirDefenseDefenderContext>;
  attacks: ReadonlyArray<AirDefenseAttack>;
  /** Keyed RNG for engagement draws. */
  engine: RandomEngine;
}

export interface AirDefenseStageResult {
  /** defenderId → next state (ammunition consumed). Empty on the no-op path. */
  nextStates: Readonly<Record<string, AirDefenseState>>;
  /** §27-ordered records emitted this minute. */
  records: AirDefenseEngagementRecord[];
  /** True when at least one engagement was drawn. */
  active: boolean;
  summary: { engagements: number; kills: number; aborts: number; disruptions: number };
}

// ---------------------------------------------------------------------------
// resolveAirDefense — per-minute air-defense stage

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function reasonCodeForOutcome(outcome: AirDefenseRecordOutcome): string {
  // §28 ships codes only for the abort/disruption attack-resolution boundaries; KILL /
  // DAMAGE / NO_EFFECT carry their outcome literal (no §28 code is invented, decision 21).
  if (outcome === "ABORT") return AIR_ATTACK_ABORTED;
  if (outcome === "DISRUPTION") return AIR_ATTACK_DISRUPTED;
  return outcome;
}

export function resolveAirDefense(
  context: AirDefenseContext,
  battleId: string,
  minute: number,
): AirDefenseStageResult {
  const summary = { engagements: 0, kills: 0, aborts: 0, disruptions: 0 };
  // ---- Strict no-op: no defenders or no attacks → empty result ----
  if (context.defenders.length === 0 || context.attacks.length === 0) {
    return { nextStates: {}, records: [], active: false, summary };
  }

  const attacksById = new Map(context.attacks.map((a) => [a.attackId, a] as const));
  const minuteInt = SafeInt(minute);
  const substep = SafeInt(AIR_DEFENSE_ENGAGEMENT_SUBSTEP);
  const records: AirDefenseEngagementRecord[] = [];
  const nextStates: Record<string, AirDefenseState> = {};

  const defenders = [...context.defenders].sort((a, b) =>
    compareIds(a.state.defenderId, b.state.defenderId),
  );

  for (const defender of defenders) {
    let state = defender.state;
    const ammunitionBySystem = new Map<string, SafeInt>();
    for (const sys of state.systems) {
      const rounds = roundsForSystem(state, sys.systemId);
      if (rounds !== undefined) ammunitionBySystem.set(sys.systemId, rounds);
    }
    const layers = resolveDefenseLayers({
      defenderId: state.defenderId,
      systems: state.systems,
      attacks: context.attacks,
      operability: defender.operability,
      protectedShipDistanceM: defender.protectedShipDistanceM ?? new Map(),
      directorAvailable: defender.directorAvailable,
      radarAvailable: defender.radarAvailable,
      ammunitionBySystem,
      channelAvailableBySystem: defender.channelAvailableBySystem ?? new Map(),
    });

    for (const layer of layers) {
      const saturationBp =
        layer.layer === "CIWS_TERMINAL_DEFENSE"
          ? computeCiwsSaturationFactorBp(layer.eligibleSystems.length)
          : NEUTRAL_BP;
      const directorFactorBp = state.directorState.scalingBp;
      const radarFactorBp = state.radarState.diminishingReturnsBp;

      for (const candidate of layer.candidates) {
        const attack = attacksById.get(candidate.attackId)!;
        const system = state.systems.find((s) => s.systemId === candidate.systemId)!;
        const recordId = `${battleId}:${minute}:ad:${state.defenderId}:${system.systemId}:${attack.attackId}`;
        const base = {
          recordId,
          minute: minuteInt,
          substep,
          defenderId: state.defenderId,
          attackerId: attack.formationId,
          attackId: attack.attackId,
          targetId: attack.targetId,
          attackType: attack.attackType,
          attackProfile: lightAaProfileForAttack(attack.attackType) ?? attack.attackType,
          layer: layer.layer,
          defenseSystemId: system.systemId,
          directorChannelId: defender.directorAvailable ? state.directorState.channelId : null,
          radarChannelId: defender.radarAvailable ? state.radarState.channelId : null,
          directorFactorBp,
          radarFactorBp,
          saturationFactorBp: saturationBp,
          crewQuality: state.crewQuality,
          damageBp: state.damageBp,
          powerBp: state.powerBp,
          timeToImpactMs: attack.timeToImpactMs,
          windowMilliseconds: SafeInt.ZERO,
          disruptionSeverity: null,
          threatReleased: attack.isReleased,
          threatFormationSize: attack.formationSize,
          modelVersion: AIR_DEFENSE_MODEL_VERSION,
          formulaVersion: AIR_DEFENSE_FORMULA_VERSION,
        };

        if (!candidate.eligible) {
          if (candidate.reason === null) continue;
          records.push(
            createAirDefenseEngagementRecord({
              ...base,
              roundsRemaining: roundsForSystem(state, system.systemId) ?? SafeInt.ZERO,
              roundsConsumed: SafeInt.ZERO,
              ammunitionMultiplierBp: ammunitionMultiplierBp(state, system.systemId),
              effectiveKillBp: SafeInt.ZERO,
              effectiveDamageBp: SafeInt.ZERO,
              effectiveAbortBp: SafeInt.ZERO,
              effectiveDisruptionBp: SafeInt.ZERO,
              draw: SafeInt.ZERO,
              outcome: "INELIGIBLE",
              reasonCode: candidate.reason,
              outcomeOrdinal: airDefenseOutcomeOrdinal("INELIGIBLE"),
              recordKind:
                layer.layer === "CIWS_TERMINAL_DEFENSE" ? "CIWS_ENGAGEMENT" : "ENGAGEMENT",
            }),
          );
          continue;
        }

        const multipliers: EngagementMultipliers = {
          directorBp: directorFactorBp,
          radarBp: radarFactorBp,
          crewBp: state.crewQuality,
          damageBp: NEUTRAL_BP, // state-authoritative (overridden in resolveEngagement)
          ammunitionBp: NEUTRAL_BP, // state-authoritative (overridden in resolveEngagement)
          targetProfileBp: defender.targetProfileBp ?? NEUTRAL_BP,
          weatherBp: defender.weatherBp ?? NEUTRAL_BP,
          saturationBp,
        };
        const ammunitionBp = ammunitionMultiplierBp(state, system.systemId);
        const resolution = resolveEngagement({
          system,
          attack,
          state,
          multipliers,
          engine: context.engine,
          identity: {
            defenderId: state.defenderId,
            systemId: system.systemId,
            attackId: attack.attackId,
            minute: minuteInt,
            substep,
          },
        });
        state = resolution.state;
        if (resolution.consumedRounds > 0) summary.engagements++;
        if (resolution.outcome === "KILL") summary.kills++;
        if (resolution.outcome === "ABORT") summary.aborts++;
        if (resolution.outcome === "DISRUPTION") summary.disruptions++;

        records.push(
          createAirDefenseEngagementRecord({
            ...base,
            roundsRemaining: roundsForSystem(state, system.systemId) ?? SafeInt.ZERO,
            roundsConsumed: resolution.consumedRounds,
            ammunitionMultiplierBp: ammunitionBp,
            effectiveKillBp: resolution.effectiveBp.kill,
            effectiveDamageBp: resolution.effectiveBp.damage,
            effectiveAbortBp: resolution.effectiveBp.abort,
            effectiveDisruptionBp: resolution.effectiveBp.disruption,
            draw: resolution.draw,
            outcome: resolution.outcome,
            reasonCode: reasonCodeForOutcome(resolution.outcome),
            outcomeOrdinal: airDefenseOutcomeOrdinal(resolution.outcome),
            recordKind: layer.layer === "CIWS_TERMINAL_DEFENSE" ? "CIWS_ENGAGEMENT" : "ENGAGEMENT",
          }),
        );
      }
    }
    nextStates[state.defenderId] = state;
  }

  return {
    nextStates,
    records: canonicallySortedAirDefenseRecords(records),
    active: summary.engagements > 0,
    summary,
  };
}
