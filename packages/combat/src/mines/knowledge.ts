//packages/combat/src/mines/knowledge.ts
// DESIGN-35 §24 mine knowledge (INC-7). Every participant HAS a SEPARATE,
// DISTINCT knowledge assertion about an area — a different object type from the
// authoritative `AreaMinePressureRecord` (§24's truth/knowledge separation). A
// knowledge record is NEVER a partial/optional view of the pressure record.
//
//   - suspected area or route;
//   - estimated pressure interval (a closed [min,max] basis-point range);
//   - estimated mine type (MineType | "UNKNOWN");
//   - suspected laying participant (id | "UNKNOWN");
//   - known cleared lanes (ordered readonly string[]);
//   - freshness estimate (basis points);
//   - last observed or swept month (SafeInt).
//
// TRUE mine pressure MUST NOT be exposed unless a source policy permits it:
// `visiblePressureTo` returns the participant's ESTIMATED interval (or an
// explicit `true` expose only when sourcePolicyPermitsValue === true). Sweeping
// improves knowledge ONLY through explicit sweep-observation records
// (`recordSweepObservation`) — never from shadow/inferred values.
//
// The assertion carries a deterministic envelope hash (canonical serializer +
// SHA-256, domain-separated with the mine_knowledge_assertion_v1 content
// version) mirroring the AreaMinePressureRecord hash convention. Pure/
// deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { MINE_BASIS_POINTS_PER_UNIT, MINE_TYPES, type MineType } from "./constants.js";
import type { AreaMinePressureRecord } from "./pressure-record.js";
import { MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

// Content version of the knowledge-assertion envelope (mine_knowledge_assertion_v1
// naming convention; INC-8 formalizes the *_v1 contract lineage).
export const mineKnowledgeAssertionContentVersion = "mine_knowledge_assertion_v1" as const;

export interface MineKnowledgeAssertion {
  /** Id of the area the assertion describes (knowledge is per area per participant). */
  areaId: string;
  /** The participant whose assessment this is. */
  participantId: string;
  /** Suspected area or route described by the assertion (§24). */
  suspectedAreaOrRoute: string;
  /** Estimated pressure interval in basis points, closed [min,max]. */
  estimatedPressureIntervalBp: readonly [number, number];
  /** Estimated mine type, or "UNKNOWN" (§24). */
  estimatedMineType: MineType | "UNKNOWN";
  /** Suspected laying participant id, or "UNKNOWN" (§24). */
  suspectedLayingParticipantId: string;
  /** Known cleared lanes, ordered (post-clearance knowledge). */
  knownClearedLanes: readonly string[];
  /** Freshness estimate in basis points [0, 10_000]. */
  freshnessEstimateBp: number;
  /** Last observed or swept month (SafeInt). */
  lastObservedOrSweptMonth: SafeInt;
  /** Deterministic SHA-256 envelope over the non-hash surface. */
  knowledgeHash: string;
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

// Closed [min,max] pressure-interval tuple helper (keeps every cast in one
// place; the surface invariant is checked by assertMineKnowledgeAssertionSurface).
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

// AC-18: reject any missing/invalid field of the MineKnowledgeAssertion
// (fail closed). Validates the surface except the knowledge-hash presence, so a
// hash-less surface can be validated before hashing.
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

// AC-18: full validation including the knowledge-hash presence requirement.
export function validateMineKnowledgeAssertion(k: MineKnowledgeAssertion): void {
  assertMineKnowledgeAssertionSurface(k);
  if (typeof k.knowledgeHash !== "string" || k.knowledgeHash.length === 0)
    invariant("knowledgeHash", k.knowledgeHash, "knowledge hash must be a non-empty string");
}

// Deterministic knowledge-hash over the non-hash surface, domain-separated with
// the mine_knowledge_assertion_v1 content version.
export function computeMineKnowledgeAssertionHash(k: MineKnowledgeAssertion): string {
  const { knowledgeHash: _ignored, ...surface } = k;
  void _ignored;
  return createEnvelope("mine-knowledge-assertion", mineKnowledgeAssertionContentVersion, surface)
    .bodyHash;
}

// Build a fully-validated assertion with its authoritative hash computed.
export function withMineKnowledgeAssertionHash(
  k: Omit<MineKnowledgeAssertion, "knowledgeHash">,
): MineKnowledgeAssertion {
  const full = k as MineKnowledgeAssertion;
  assertMineKnowledgeAssertionSurface(full);
  return { ...k, knowledgeHash: computeMineKnowledgeAssertionHash(full) };
}

// Fail-closed content-hash verification.
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

// AC-18: builder for a participant's knowledge assertion. `knownClearedLanes`
// defaults to [] and `freshnessEstimateBp` defaults to 0 (no observation yet) and
// `lastObservedOrSweptMonth` defaults to 0 (never observed) — explicit defaults
// matching the §24 "unknown until observed first" posture.
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

// AC-18: append a known cleared lane (ordered, deduplicated) — post-clearance
// knowledge improvement.
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
  /** The campaign month of the sweep. */
  observedMonth: SafeInt;
  /** Observed cleared lanes (additive to the assertion). */
  clearedLanes: readonly string[];
  /** Observed (post-sweep) pressure interval in basis points. */
  observedPressureIntervalBp: readonly [number, number];
  /** Observed mine type, or "UNKNOWN". */
  observedMineType: MineType | "UNKNOWN";
  /** Observed freshness estimate in basis points. */
  observedFreshnessEstimateBp: number;
}

// AC-18: sweeping improves knowledge ONLY through an EXPLICIT sweep-observation
// record (never a shadow/inferred value). Merges the observation into the
// participant's assertion: cleared lanes appended, interval + mine type +
// freshness updated, lastObservedOrSweptMonth set. Returns a NEW assertion.
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
  /** The authoritative true pressure (only when sourcePolicyPermitsValue === true). */
  exposedTruePressure: SafeInt | null;
  /** The participant's estimated pressure interval in basis points. */
  estimatedPressureIntervalBp: readonly [number, number];
  /** True only when a source policy explicitly permits the exact value. */
  exactValueExposed: boolean;
}

// AC-18: TRUE mine pressure MUST NOT be exposed absent an explicit source policy
// (§24). This guard returns the participant's ESTIMATED interval, and ONLY when
// sourcePolicyPermitsValue === true returns the true authoritative pressure. The
// true number never leaks when not permitted — the caller only ever sees the
// estimate (never the exact value from `record.pressure` restated here).
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

// Fail-closed purity guard: assert that a pressure value that the caller intends
// to expose is either the participant's own estimate or explicitly permitted —
// never the raw authoritative pressure absent permission. Throws when not
// permitted AND the exposed value would be the true pressure.
export function assertPressureNotExposed(
  record: AreaMinePressureRecord,
  knowledge: MineKnowledgeAssertion,
  sourcePolicyPermitsValue: boolean,
): VisiblePressureResult {
  const result = visiblePressureTo(record, knowledge, sourcePolicyPermitsValue);
  if (!sourcePolicyPermitsValue) {
    // The estimate (in basis points) is a DIFFERENT scale than the authoritative
    // pressure; the guard ensures the caller never coerces the raw pressure out.
    // We re-expose the interval and confirm exactValueExposed is false.
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
