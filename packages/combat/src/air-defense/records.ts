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

export type AirDefenseRecordLayer = (typeof FULL_DEFENSE_LAYER_ORDER)[number];

export type AirDefenseRecordOutcome =
  | EngagementOutcome
  | "OPPORTUNITY_CREATED"
  | "INELIGIBLE"
  | "EXHAUSTED"
  | "DIRECTOR_ASSIGNED";

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
  attackerId: string;
  attackId: string;
  targetId: string;
  attackType: AttackTypeId;
  attackProfile: string;
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
  return Object.freeze(record);
}

export function verifyAirDefenseEngagementRecordHash(record: AirDefenseEngagementRecord): boolean {
  const { recordHash, ...body } = record;
  return computeAirDefenseEngagementRecordHash(body) === recordHash;
}

export function assertAirDefenseEngagementRecordHash(record: AirDefenseEngagementRecord): void {
  if (!verifyAirDefenseEngagementRecordHash(record)) {
    throw new BluewaveError("assertAirDefenseEngagementRecordHash: record hash mismatch", {
      code: AIR_DEFENSE_INVARIANT_FAILED,
      recordId: record.recordId,
    });
  }
}

export interface LightAaDisruptionOpportunityRecordInput {
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
    roundsConsumed: SafeInt.ZERO,
    ammunitionMultiplierBp: input.ammunitionMultiplierBp,
    timeToImpactMs: input.timeToImpactMs,
    windowMilliseconds: input.windowMilliseconds,
    effectiveKillBp: input.effectiveKillBp,
    effectiveDamageBp: input.effectiveDamageBp,
    effectiveAbortBp: input.effectiveAbortBp,
    effectiveDisruptionBp: input.effectiveDisruptionBp,
    draw: SafeInt.ZERO,
    outcome: "OPPORTUNITY_CREATED",
    disruptionSeverity: null,
    threatReleased: input.threatReleased,
    threatFormationSize: input.threatFormationSize,
    reasonCode: LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
    outcomeOrdinal: airDefenseOutcomeOrdinal("OPPORTUNITY_CREATED"),
    recordKind: "LIGHT_AA_DISRUPTION_OPPORTUNITY",
    modelVersion: AIR_DEFENSE_MODEL_VERSION,
    formulaVersion: AIR_DEFENSE_FORMULA_VERSION,
  });
}
