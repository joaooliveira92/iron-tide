// D-4 M4 Aviation: Air Defense — AC-15 AirDefenseEngagementRecord per DESIGN-45 §26/§27.
// Parallel to air-combat/records.ts pattern.
//
// §26: every detection, threat assignment, director assignment, CAP interception, SAM
// engagement, AA engagement, light-AA disruption opportunity, CIWS engagement, ammunition
// use, jam, kill, damage, abort, and disruption MUST create an immutable record containing
// battle timing, asset identifiers, attack type/profile, defense layer/system, state, timing
// and channel allocation, scaling/saturation values, probability/random decisions, outcome
// and persistence effects, formula/ruleset versions, and a record hash.
//
// §28 ships no dedicated record-integrity code; the canonical §28 invariant boundary
// AIR_DEFENSE_INVARIANT_FAILED is used for record-hash failures (documented resolution,
// ADR-0042 — no INVALID_AIR_DEFENSE_RECORD code is invented).
//
// The record body is deliberately JSON-serializable (primitives + null only): the hash is
// taken over the canonicalized body so identical state produces identical hashes (§29.28).

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import type { AttackTypeId } from "./attack.js";
import type { DisruptionSeverityType } from "./air-defense-state.js";
import {
  AIR_DEFENSE_FORMULA_VERSION,
  AIR_DEFENSE_MODEL_VERSION,
  FULL_DEFENSE_LAYER_ORDER,
} from "./constants.js";
import type { EngagementOutcome } from "./engagement.js";
import type { LightAaDisruptionOpportunityResult } from "./light-aa-disruption.js";
import {
  AIR_DEFENSE_INVARIANT_FAILED,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
} from "./reasonCodes.js";

export const AIR_DEFENSE_RECORD_POLICY_ID = "air_defense_record_v1" as const;

/** The full §1 defense-layer set, as the record's `layer` union. */
export type AirDefenseRecordLayer = (typeof FULL_DEFENSE_LAYER_ORDER)[number];

/**
 * Primary outcome of a record. The five §5 engagement outcomes plus the four §26
 * non-engagement outcomes: an ineligible attempt, an exhausted (CAP/SAM) attempt, a
 * director assignment, and the guaranteed light-AA disruption opportunity.
 */
export type AirDefenseRecordOutcome =
  | EngagementOutcome
  | "OPPORTUNITY_CREATED"
  | "INELIGIBLE"
  | "EXHAUSTED"
  | "DIRECTOR_ASSIGNED";

/** §26 record kinds (one per §26 bullet family). */
export type AirDefenseRecordKind =
  | "ENGAGEMENT"
  | "CAP_INTERCEPTION_INELIGIBLE"
  | "CAP_EXHAUSTED"
  | "DIRECTOR_ASSIGNMENT"
  | "DISRUPTION"
  | "CIWS_ENGAGEMENT"
  | "LIGHT_AA_DISRUPTION_OPPORTUNITY";

export interface AirDefenseEngagementRecord {
  recordId: string;
  minute: SafeInt;
  substep: SafeInt;
  defenderId: string;
  attackerId: string; // attacking formation identifier
  attackId: string;
  targetId: string; // defended ship identifier under attack
  attackType: AttackTypeId;
  attackProfile: string; // §9 light-AA profile key or the attack type when no profile applies
  layer: AirDefenseRecordLayer;
  defenseSystemId: string;
  directorChannelId: string | null;
  radarChannelId: string | null;
  directorFactorBp: SafeInt;
  radarFactorBp: SafeInt;
  saturationFactorBp: SafeInt;
  crewQuality: SafeInt;
  damageBp: SafeInt;
  powerBp: SafeInt;
  roundsRemaining: SafeInt;
  roundsConsumed: SafeInt;
  ammunitionMultiplierBp: SafeInt;
  timeToImpactMs: SafeInt;
  windowMilliseconds: SafeInt;
  effectiveKillBp: SafeInt;
  effectiveDamageBp: SafeInt;
  effectiveAbortBp: SafeInt;
  effectiveDisruptionBp: SafeInt;
  draw: SafeInt;
  outcome: AirDefenseRecordOutcome;
  disruptionSeverity: DisruptionSeverityType | null;
  threatReleased: boolean;
  threatFormationSize: SafeInt;
  reasonCode: string;
  outcomeOrdinal: SafeInt;
  recordKind: AirDefenseRecordKind;
  modelVersion: string;
  formulaVersion: string;
  recordHash: string;
}

type AirDefenseEngagementRecordBody = Omit<AirDefenseEngagementRecord, "recordHash">;

// ---- §27.8 outcome-effect ordinal ----
// Increasing effect strength: an ineligible attempt (0) < exhausted (1) < director assigned
// (2) < disruption opportunity granted (3) < no effect (4) < disruption (5) < abort (6) <
// damage (7) < kill (8). This is the ONLY canonical "outcome effect ordinal" — a monotone,
// total order over every §26 outcome used by the §27.8 ordering key.
export const AIR_DEFENSE_OUTCOME_ORDINALS: Readonly<Record<AirDefenseRecordOutcome, number>> = {
  INELIGIBLE: 0,
  EXHAUSTED: 1,
  DIRECTOR_ASSIGNED: 2,
  OPPORTUNITY_CREATED: 3,
  NO_EFFECT: 4,
  DISRUPTION: 5,
  ABORT: 6,
  DAMAGE: 7,
  KILL: 8,
};

/** §27.8 outcome-effect ordinal for a record outcome (fail-closed on unknown outcomes). */
export function airDefenseOutcomeOrdinal(outcome: AirDefenseRecordOutcome): SafeInt {
  const ordinal = AIR_DEFENSE_OUTCOME_ORDINALS[outcome];
  if (ordinal === undefined) {
    throw new BluewaveError("airDefenseOutcomeOrdinal: unknown outcome", {
      code: AIR_DEFENSE_INVARIANT_FAILED,
      outcome,
    });
  }
  return SafeInt(ordinal);
}

// ---- Hash / create / verify / assert ----

export function computeAirDefenseEngagementRecordHash(
  body: AirDefenseEngagementRecordBody,
): string {
  return createEnvelope("air-defense-record", AIR_DEFENSE_RECORD_POLICY_ID, body).bodyHash;
}

export function createAirDefenseEngagementRecord(
  params: AirDefenseEngagementRecordBody,
): AirDefenseEngagementRecord {
  const body: AirDefenseEngagementRecordBody = { ...params };
  const record: AirDefenseEngagementRecord = {
    ...body,
    recordHash: computeAirDefenseEngagementRecordHash(body),
  };
  // §26: records are immutable. Shallow freeze suffices — the body carries primitives only.
  return Object.freeze(record);
}

export function verifyAirDefenseEngagementRecordHash(record: AirDefenseEngagementRecord): boolean {
  const { recordHash, ...body } = record;
  return computeAirDefenseEngagementRecordHash(body) === recordHash;
}

/** §26 record integrity: a tampered or inconsistent record fails with AIR_DEFENSE_INVARIANT_FAILED. */
export function assertAirDefenseEngagementRecordHash(record: AirDefenseEngagementRecord): void {
  if (!verifyAirDefenseEngagementRecordHash(record)) {
    throw new BluewaveError("assertAirDefenseEngagementRecordHash: record hash mismatch", {
      code: AIR_DEFENSE_INVARIANT_FAILED,
      recordId: record.recordId,
    });
  }
}

// ---- AC-7: guaranteed light-AA disruption opportunity record ----

export interface LightAaDisruptionOpportunityRecordInput {
  /** The AC-7 resolution — MUST be `opportunityCreated === true` (fail-closed). */
  opportunity: LightAaDisruptionOpportunityResult;
  recordId: string;
  defenderId: string;
  attackerId: string;
  attackId: string;
  targetId: string;
  attackType: AttackTypeId;
  attackProfile: string;
  defenseSystemId: string;
  directorChannelId: string | null;
  radarChannelId: string | null;
  directorFactorBp: SafeInt;
  radarFactorBp: SafeInt;
  saturationFactorBp: SafeInt;
  crewQuality: SafeInt;
  damageBp: SafeInt;
  powerBp: SafeInt;
  roundsRemaining: SafeInt;
  ammunitionMultiplierBp: SafeInt;
  timeToImpactMs: SafeInt;
  windowMilliseconds: SafeInt;
  effectiveKillBp: SafeInt;
  effectiveDamageBp: SafeInt;
  effectiveAbortBp: SafeInt;
  effectiveDisruptionBp: SafeInt;
  threatReleased: boolean;
  threatFormationSize: SafeInt;
}

/**
 * AC-7 (§26): builds the immutable record for a GRANTED light-AA disruption opportunity.
 * The opportunity guarantees ONLY the disruption check at one authoritative substep (§29.8);
 * it guarantees no ammunition, hit, damage, or abort (§29.9) — hence draw = 0 (no random
 * decision taken yet), roundsConsumed = 0 (nothing fired), and outcome = OPPORTUNITY_CREATED.
 * A not-created opportunity (or a non-matching checkSubstep) is an invariant violation.
 */
export function createLightAaDisruptionOpportunityRecord(
  input: LightAaDisruptionOpportunityRecordInput,
): AirDefenseEngagementRecord {
  const { opportunity } = input;
  if (!opportunity.opportunityCreated) {
    throw new BluewaveError(
      "createLightAaDisruptionOpportunityRecord: only a CREATED opportunity produces an opportunity record",
      { code: AIR_DEFENSE_INVARIANT_FAILED, reasonCode: opportunity.reasonCode },
    );
  }
  return createAirDefenseEngagementRecord({
    recordId: input.recordId,
    minute: opportunity.checkMinute,
    substep: opportunity.checkSubstep,
    defenderId: input.defenderId,
    attackerId: input.attackerId,
    attackId: input.attackId,
    targetId: input.targetId,
    attackType: input.attackType,
    attackProfile: input.attackProfile,
    layer: "LIGHT_AA",
    defenseSystemId: input.defenseSystemId,
    directorChannelId: input.directorChannelId,
    radarChannelId: input.radarChannelId,
    directorFactorBp: input.directorFactorBp,
    radarFactorBp: input.radarFactorBp,
    saturationFactorBp: input.saturationFactorBp,
    crewQuality: input.crewQuality,
    damageBp: input.damageBp,
    powerBp: input.powerBp,
    roundsRemaining: input.roundsRemaining,
    roundsConsumed: SafeInt.ZERO, // §29.9: the opportunity does not fire ammunition
    ammunitionMultiplierBp: input.ammunitionMultiplierBp,
    timeToImpactMs: input.timeToImpactMs,
    windowMilliseconds: input.windowMilliseconds,
    effectiveKillBp: input.effectiveKillBp,
    effectiveDamageBp: input.effectiveDamageBp,
    effectiveAbortBp: input.effectiveAbortBp,
    effectiveDisruptionBp: input.effectiveDisruptionBp,
    draw: SafeInt.ZERO, // §29.9: no random decision is taken by creating the opportunity
    outcome: "OPPORTUNITY_CREATED",
    disruptionSeverity: null, // the §6 disruption draw happens at attack resolution (INC-6)
    threatReleased: input.threatReleased,
    threatFormationSize: input.threatFormationSize,
    reasonCode: LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
    outcomeOrdinal: airDefenseOutcomeOrdinal("OPPORTUNITY_CREATED"),
    recordKind: "LIGHT_AA_DISRUPTION_OPPORTUNITY",
    modelVersion: AIR_DEFENSE_MODEL_VERSION,
    formulaVersion: AIR_DEFENSE_FORMULA_VERSION,
  });
}
