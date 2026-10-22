import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { MINE_BASIS_POINTS_PER_UNIT, MINE_TYPES, type MineType } from "./constants.js";
import type { AreaMinePressureRecord } from "./pressure-record.js";
import { MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

export const mineKnowledgeAssertionContentVersion = "mine_knowledge_assertion_v1" as const;

export interface MineKnowledgeAssertion {
  areaId: string;
  participantId: string;
  suspectedAreaOrRoute: string;
  estimatedPressureIntervalBp: readonly [number, number];
  estimatedMineType: MineType | "UNKNOWN";
  suspectedLayingParticipantId: string;
  knownClearedLanes: readonly string[];
  freshnessEstimateBp: number;
  lastObservedOrSweptMonth: SafeInt;
  knowledgeHash: string;
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function pressureInterval(min: number, max: number): readonly [number, number] {
  return [min, max] as readonly [number, number];
}

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
    code: MINE_WARFARE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function assertMineKnowledgeAssertionSurface(k: MineKnowledgeAssertion): void {
  if (typeof k.areaId !== "string" || k.areaId.length === 0)
    invariant("areaId", k.areaId, "knowledge assertion requires a non-empty area id");
  if (typeof k.participantId !== "string" || k.participantId.length === 0)
    invariant("participantId", k.participantId, "knowledge assertion requires a participant id");
  if (typeof k.suspectedAreaOrRoute !== "string" || k.suspectedAreaOrRoute.length === 0)
    invariant(
      "suspectedAreaOrRoute",
      k.suspectedAreaOrRoute,
      "suspected area or route must be a non-empty string",
    );

  if (
    !Array.isArray(k.estimatedPressureIntervalBp) ||
    k.estimatedPressureIntervalBp.length !== 2 ||
    !isInt(k.estimatedPressureIntervalBp[0]) ||
    !isInt(k.estimatedPressureIntervalBp[1]) ||
    k.estimatedPressureIntervalBp[0] < 0 ||
    k.estimatedPressureIntervalBp[1] > MINE_BASIS_POINTS_PER_UNIT * 100 ||
    k.estimatedPressureIntervalBp[0] > k.estimatedPressureIntervalBp[1]
  )
    invariant(
      "estimatedPressureIntervalBp",
      k.estimatedPressureIntervalBp,
      "estimated pressure interval must be a closed [min,max] integer basis-point range with min <= max",
    );

  if (
    k.estimatedMineType !== "UNKNOWN" &&
    !(MINE_TYPES as readonly string[]).includes(k.estimatedMineType)
  )
    invariant(
      "estimatedMineType",
      k.estimatedMineType,
      "estimated mine type must be a canonical §2 mine type or UNKNOWN",
    );

  if (
    typeof k.suspectedLayingParticipantId !== "string" ||
    k.suspectedLayingParticipantId.length === 0
  )
    invariant(
      "suspectedLayingParticipantId",
      k.suspectedLayingParticipantId,
      "suspected laying participant must be a non-empty string or UNKNOWN",
    );

  if (!Array.isArray(k.knownClearedLanes))
    invariant("knownClearedLanes", k.knownClearedLanes, "known cleared lanes must be an array");
  for (const lane of k.knownClearedLanes) {
    if (typeof lane !== "string" || lane.length === 0)
      invariant(
        "knownClearedLanes",
        k.knownClearedLanes,
        "cleared lane must be a non-empty string",
      );
  }

  if (
    !isInt(k.freshnessEstimateBp) ||
    k.freshnessEstimateBp < 0 ||
    k.freshnessEstimateBp > MINE_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "freshnessEstimateBp",
      k.freshnessEstimateBp,
      `freshness estimate must be in [0, ${MINE_BASIS_POINTS_PER_UNIT}]`,
    );

  if (!SafeInt.isSafeInt(k.lastObservedOrSweptMonth))
    invariant(
      "lastObservedOrSweptMonth",
      k.lastObservedOrSweptMonth,
      "last observed/swept month must be a safe integer",
    );
}

export function validateMineKnowledgeAssertion(k: MineKnowledgeAssertion): void {
  assertMineKnowledgeAssertionSurface(k);
  if (typeof k.knowledgeHash !== "string" || k.knowledgeHash.length === 0)
    invariant("knowledgeHash", k.knowledgeHash, "knowledge hash must be a non-empty string");
}

export function computeMineKnowledgeAssertionHash(k: MineKnowledgeAssertion): string {
  const { knowledgeHash: _ignored, ...surface } = k;
  void _ignored;
  return createEnvelope("mine-knowledge-assertion", mineKnowledgeAssertionContentVersion, surface)
    .bodyHash;
}

export function withMineKnowledgeAssertionHash(
  k: Omit<MineKnowledgeAssertion, "knowledgeHash">,
): MineKnowledgeAssertion {
  const full = k as MineKnowledgeAssertion;
  assertMineKnowledgeAssertionSurface(full);
  return { ...k, knowledgeHash: computeMineKnowledgeAssertionHash(full) };
}

export function verifyMineKnowledgeAssertionHash(k: MineKnowledgeAssertion): boolean {
  return computeMineKnowledgeAssertionHash(k) === k.knowledgeHash;
}

export interface BuildMineKnowledgeAssertionInput {
  areaId: string;
  participantId: string;
  suspectedAreaOrRoute: string;
  estimatedPressureIntervalBp: readonly [number, number];
  estimatedMineType: MineType | "UNKNOWN";
  suspectedLayingParticipantId: string;
  knownClearedLanes?: readonly string[];
  freshnessEstimateBp?: number;
  lastObservedOrSweptMonth?: SafeInt;
}

export function buildMineKnowledgeAssertion(
  input: BuildMineKnowledgeAssertionInput,
): MineKnowledgeAssertion {
  return withMineKnowledgeAssertionHash({
    areaId: input.areaId,
    participantId: input.participantId,
    suspectedAreaOrRoute: input.suspectedAreaOrRoute,
    estimatedPressureIntervalBp: pressureInterval(
      input.estimatedPressureIntervalBp[0],
      input.estimatedPressureIntervalBp[1],
    ),
    estimatedMineType: input.estimatedMineType,
    suspectedLayingParticipantId: input.suspectedLayingParticipantId,
    knownClearedLanes: [...(input.knownClearedLanes ?? [])],
    freshnessEstimateBp: input.freshnessEstimateBp ?? 0,
    lastObservedOrSweptMonth: input.lastObservedOrSweptMonth ?? SafeInt.ZERO,
  });
}

export function clearLaneInKnowledge(
  knowledge: MineKnowledgeAssertion,
  laneId: string,
): MineKnowledgeAssertion {
  if (typeof laneId !== "string" || laneId.length === 0)
    invariant("laneId", laneId, "cleared lane id must be a non-empty string");
  const lanes = [...knowledge.knownClearedLanes];
  if (!lanes.includes(laneId)) lanes.push(laneId);
  return withMineKnowledgeAssertionHash({ ...knowledge, knownClearedLanes: lanes });
}

export interface SweepObservationRecord {
  observedMonth: SafeInt;
  clearedLanes: readonly string[];
  observedPressureIntervalBp: readonly [number, number];
  observedMineType: MineType | "UNKNOWN";
  observedFreshnessEstimateBp: number;
}

export function recordSweepObservation(
  knowledge: MineKnowledgeAssertion,
  sweepRecord: SweepObservationRecord,
): MineKnowledgeAssertion {
  if (!SafeInt.isSafeInt(sweepRecord.observedMonth))
    invariant("observedMonth", sweepRecord.observedMonth, "observed month must be a safe integer");
  if (
    sweepRecord.observedMineType !== "UNKNOWN" &&
    !(MINE_TYPES as readonly string[]).includes(sweepRecord.observedMineType)
  )
    invariant(
      "observedMineType",
      sweepRecord.observedMineType,
      "observed mine type must be a canonical §2 mine type or UNKNOWN",
    );
  const interval = sweepRecord.observedPressureIntervalBp;
  if (
    !Array.isArray(interval) ||
    interval.length !== 2 ||
    !isInt(interval[0]) ||
    !isInt(interval[1]) ||
    interval[0] < 0 ||
    interval[1] > MINE_BASIS_POINTS_PER_UNIT * 100 ||
    interval[0] > interval[1]
  )
    invariant(
      "observedPressureIntervalBp",
      interval,
      "observed pressure interval must be a closed [min,max] integer basis-point range",
    );
  if (
    !isInt(sweepRecord.observedFreshnessEstimateBp) ||
    sweepRecord.observedFreshnessEstimateBp < 0 ||
    sweepRecord.observedFreshnessEstimateBp > MINE_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "observedFreshnessEstimateBp",
      sweepRecord.observedFreshnessEstimateBp,
      `observed freshness estimate must be in [0, ${MINE_BASIS_POINTS_PER_UNIT}]`,
    );

  const lanes = [...knowledge.knownClearedLanes];
  for (const lane of sweepRecord.clearedLanes) {
    if (typeof lane === "string" && lane.length > 0 && !lanes.includes(lane)) lanes.push(lane);
  }

  return withMineKnowledgeAssertionHash({
    ...knowledge,
    knownClearedLanes: lanes,
    estimatedPressureIntervalBp: pressureInterval(interval[0], interval[1]),
    estimatedMineType: sweepRecord.observedMineType,
    freshnessEstimateBp: sweepRecord.observedFreshnessEstimateBp,
    lastObservedOrSweptMonth: sweepRecord.observedMonth,
  });
}

export interface VisiblePressureResult {
  exposedTruePressure: SafeInt | null;
  estimatedPressureIntervalBp: readonly [number, number];
  exactValueExposed: boolean;
}

export function visiblePressureTo(
  record: AreaMinePressureRecord,
  knowledge: MineKnowledgeAssertion,
  sourcePolicyPermitsValue: boolean,
): VisiblePressureResult {
  if (knowledge.participantId.length === 0)
    invariant(
      "participantId",
      knowledge.participantId,
      "knowledge assertion requires a participant id",
    );
  if (sourcePolicyPermitsValue) {
    return {
      exposedTruePressure: record.pressure,
      estimatedPressureIntervalBp: pressureInterval(
        knowledge.estimatedPressureIntervalBp[0],
        knowledge.estimatedPressureIntervalBp[1],
      ),
      exactValueExposed: true,
    };
  }
  return {
    exposedTruePressure: null,
    estimatedPressureIntervalBp: pressureInterval(
      knowledge.estimatedPressureIntervalBp[0],
      knowledge.estimatedPressureIntervalBp[1],
    ),
    exactValueExposed: false,
  };
}

export function assertPressureNotExposed(
  record: AreaMinePressureRecord,
  knowledge: MineKnowledgeAssertion,
  sourcePolicyPermitsValue: boolean,
): VisiblePressureResult {
  const result = visiblePressureTo(record, knowledge, sourcePolicyPermitsValue);
  if (!sourcePolicyPermitsValue) {
    if (result.exactValueExposed) {
      invariant(
        "exactValueExposed",
        result,
        "no source policy permitted the value but an exact value was requested (§24) — true pressure must not leak",
      );
    }
  }
  return result;
}
