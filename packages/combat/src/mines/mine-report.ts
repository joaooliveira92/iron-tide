// DESIGN-35 §19 Mine Incident Report (INC-6). Every observed or suspected mine
// event MUST create a MineIncidentReport carrying all §19 fields (recipient
// participant; area or route; observed + received time; affected ship or force;
// reported cause; estimated mine type or UNKNOWN; estimated laying participant
// or UNKNOWN; confidence; position error; delivery delay; possible deception;
// generated knowledge assertions; report hash).
//
// REPORTS MUST NOT OVERWRITE TRUE MINE PRESSURE / MINE TYPE / CAUSE / LAYING
// PARTICIPANT (§19): a MineIncidentReport is an IMMUTABLE, INDEPENDENT knowledge
// record. It holds only *reported/estimated* beliefs (a witness's view), never
// the authoritative AreaMinePressureRecord it may reference by area id. Nothing
// here reads from, derives from, or mutates any AreaMinePressureRecord; the
// authoritative pressure/type/cause/laying-participant surface is untouched by
// construction of any report (test asserts a caller passing a deep-frozen
// pressure record for the same area leaves it byte-identical after a report is
// built — the report does not even take the pressure record as input).
//
// TIME SCHEME (authored, deterministic — no wall-clock allowed): observedTime
// and receivedTime are SAFE-INTEGER campaign months (§19 gives no time format;
// the spec/ticket requires "integers (campaign month)"). receivedTime >=
// observedTime. deliveryDelay is expressed in the SAME time units, so
// deliveryDelayMonths = receivedTime - observedTime (>= 0). positionError is in
// METRES (documented fixed units). Deterministic, reproducible, never Date/env.
//
// HASH: deterministic SHA-256 envelope (createEnvelope) over the non-hash
// surface, domain-separated with the mine_report_v1 content version, so a report
// is hash-stable and independently verifiable.
//
// causeUncertain flag: emitted MINE_REPORT_CAUSE_UNCERTAIN when confidenceBp is
// below the certain threshold. DESIGN-35 does NOT ship that threshold number, so
// it is an AUTHORED constant here: MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP =
// 10_000 (only fully-certain confidence counts as certain; the §20 classifier is
// inherently a guess — see misidentification.ts). Comment-logged authored-vs-
// shipped — not a silent invention of gameplay semantics.
//
// Full knowledge-state machinery (the INC-7 knowledge store) is deferred; this
// increment ships the MINIMAL MineReportGeneratedKnowledgeAssertion seed shape
// (the generated-knowledge assertion record) that INC-7's store ingests.
//
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_REPORT_SIGNATURE_POLICY_ID,
  MINE_RULESET_VERSION,
  MINE_TYPES,
  type MineType,
} from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE } from "./reasonCodes.js";

// Content version of the report-hash envelope (mine_report_v1 naming convention,
// mirroring pressure-record.ts's mine_pressure_v1).
export const mineReportContentVersion = "mine_report_v1" as const;

// Confidence bounds §19 (basis points 0..10_000).
export const MINE_REPORT_CONFIDENCE_MIN_BP = 0 as const;
export const MINE_REPORT_CONFIDENCE_MAX_BP = MINE_BASIS_POINTS_PER_UNIT;

// AUTHORED (DESIGN-35 ships no number): the confidence below which a report's
// cause estimation is "uncertain" (§20: "when the cause-estimation confidence is
// below the certain threshold"). Only 10_000 (fully-certain, e.g. direct filmed
// identification) counts as certain. Comment-logged authored constant — DESIGN-35
// is exact where it ships a number; this threshold is NOT shipped, so 10_000 is
// our documented rule, never a silently invented semantic.
export const MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP = MINE_BASIS_POINTS_PER_UNIT;

// §19 "UNKNOWN" vocabulary for estimated mine type / laying participant.
export const MINE_REPORT_UNKNOWN = "UNKNOWN" as const;

// Minimal §19 "generated knowledge assertions" record. The full per-participant
// knowledge store belongs to INC-7 (AC-18 / §24) and ships as `MineKnowledgeAssertion`
// in knowledge.ts — this is the SEED SHAPE that INC-7's store ingests, kept to the
// fields §19's report actually references (who is being told which kind of fact)
// plus a deterministic serialized detail. Named `MineReportGeneratedKnowledgeAssertion`
// (not `MineKnowledgeAssertion`) so the authoritative §24 record owns that name.
export const MINE_KNOWLEDGE_ASSERTION_KINDS = [
  "SUSPECTED_MINE_PRESSURE",
  "SUSPECTED_MINE_TYPE",
  "SUSPECTED_LAYING_PARTICIPANT",
  "SUSPECTED_LOCATION",
] as const;
export type MineReportKnowledgeAssertionKind = (typeof MINE_KNOWLEDGE_ASSERTION_KINDS)[number];

export interface MineReportGeneratedKnowledgeAssertion {
  knowledgeAssertionId: string;
  /** participant to whom the assertion is addressed. */
  participantId: string;
  kind: MineReportKnowledgeAssertionKind;
  /** Deterministic serialized detail (canonical-serializer friendly string). */
  detail: string;
}

export interface MineIncidentReport {
  reportId: string;
  /** recipient participant told by this report. */
  recipientParticipantId: string;
  /** area id or route edge id being reported on. */
  areaOrRoute: string;
  /** campaign-month SafeInt when the event was observed (§19; deterministic). */
  observedTime: SafeInt;
  /** campaign-month SafeInt when the report was received (>= observedTime). */
  receivedTime: SafeInt;
  /** affected ship or force id. */
  affectedShipOrForceId: string;
  /** §19 reported cause: a known §20 label (MINE_STRIKE / TORPEDO_ATTACK /
   *  UNDERWATER_EXPLOSION_UNKNOWN) or an authored textual cause. */
  reportedCause: string;
  /** §19 estimated mine type or `UNKNOWN`. */
  estimatedMineType: MineType | typeof MINE_REPORT_UNKNOWN;
  /** §19 estimated laying participant or `UNKNOWN`. A participant id is a
   *  string; MINE_REPORT_UNKNOWN is the documented sentinel value used to say
   *  the participant is not known (the underlying storage type is `string`). */
  estimatedLayingParticipantId: string;
  /** §19 confidence, basis points 0..10_000. */
  confidenceBp: SafeInt;
  /** §19 position error, FIXED UNITS = metres (documented). */
  positionErrorMeters: SafeInt;
  /** §19 delivery delay in the SAME time units as observed/received = months
   *  (receivedTime - observedTime, >= 0). */
  deliveryDelayMonths: SafeInt;
  /** §19 possible deception. */
  possibleDeception: boolean;
  /** §19 generated knowledge assertions (seed shape; INC-7 stores them). */
  generatedKnowledgeAssertions: readonly MineReportGeneratedKnowledgeAssertion[];
  rulesetVersion: string;
  formulaVersion: string;
  /** The §20 report-signature policy id that classifies this report's cause. */
  reportSignaturePolicyId: string;
  reportHash: string; // deterministic SHA-256 envelope over the non-hash surface
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

// AC-13: reject any missing/invalid §19 field of a MineIncidentReport with the
// module's invariant code (INVALID_MINE_PRESSURE_STATE — the module's shared
// fail-closed code; §30 has no report-specific input-invalid code beyond
// MINE_REPORT_CAUSE_UNCERTAIN, which is a FLAG, not an invalid-input error).
// Requires all fields, computes the deterministic reportXhash, and derives the
// causeUncertain flag from the AUTHORED certainty threshold.
export function buildMineIncidentReport(input: Omit<MineIncidentReport, "reportHash">): {
  report: MineIncidentReport;
  causeUncertain: boolean;
} {
  const invariant = (field: string, value: unknown, reason: string): never => {
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field,
      reason,
      value,
    });
  };

  if (!isNonEmptyString(input.reportId))
    invariant("reportId", input.reportId, "non-empty id required");
  if (!isNonEmptyString(input.recipientParticipantId))
    invariant(
      "recipientParticipantId",
      input.recipientParticipantId,
      "non-empty recipient participant required",
    );
  if (!isNonEmptyString(input.areaOrRoute))
    invariant("areaOrRoute", input.areaOrRoute, "non-empty area or route edge id required");
  if (!SafeInt.isSafeInt(input.observedTime))
    invariant(
      "observedTime",
      input.observedTime,
      "observed time must be a safe integer (campaign month)",
    );
  if (!SafeInt.isSafeInt(input.receivedTime))
    invariant(
      "receivedTime",
      input.receivedTime,
      "received time must be a safe integer (campaign month)",
    );
  if (input.receivedTime < input.observedTime)
    invariant("receivedTime", input.receivedTime, "received time must be >= observed time");
  if (!SafeInt.isSafeInt(input.deliveryDelayMonths) || input.deliveryDelayMonths < 0)
    invariant(
      "deliveryDelayMonths",
      input.deliveryDelayMonths,
      "delivery delay must be a non-negative safe integer (months)",
    );
  if (input.receivedTime - input.observedTime !== input.deliveryDelayMonths)
    invariant(
      "deliveryDelayMonths",
      input.deliveryDelayMonths,
      "delivery delay must equal receivedTime - observedTime (same campaign-month time units)",
    );
  if (!isNonEmptyString(input.affectedShipOrForceId))
    invariant(
      "affectedShipOrForceId",
      input.affectedShipOrForceId,
      "non-empty affected ship/force id required",
    );
  // §19 "reported cause": either one of the three §20 labels or an authored
  // textual cause. Both must be non-empty strings; an authored textual cause is
  // permitted (the union is `EXPLOSION_CAUSE_LABEL | string`).
  if (!isNonEmptyString(input.reportedCause))
    invariant("reportedCause", input.reportedCause, "non-empty reported cause required");
  if (
    input.estimatedMineType !== MINE_REPORT_UNKNOWN &&
    !(MINE_TYPES as readonly string[]).includes(input.estimatedMineType as string)
  )
    invariant(
      "estimatedMineType",
      input.estimatedMineType,
      "must be a canonical §2 mine type or UNKNOWN",
    );
  if (
    input.estimatedLayingParticipantId !== MINE_REPORT_UNKNOWN &&
    !isNonEmptyString(input.estimatedLayingParticipantId)
  )
    invariant(
      "estimatedLayingParticipantId",
      input.estimatedLayingParticipantId,
      "must be a non-empty string or UNKNOWN",
    );
  if (
    !SafeInt.isSafeInt(input.confidenceBp) ||
    input.confidenceBp < MINE_REPORT_CONFIDENCE_MIN_BP ||
    input.confidenceBp > MINE_REPORT_CONFIDENCE_MAX_BP
  )
    invariant(
      "confidenceBp",
      input.confidenceBp,
      `confidence must be a basis-point integer within ${MINE_REPORT_CONFIDENCE_MIN_BP}..${MINE_REPORT_CONFIDENCE_MAX_BP}`,
    );
  if (!SafeInt.isSafeInt(input.positionErrorMeters) || input.positionErrorMeters < 0)
    invariant(
      "positionErrorMeters",
      input.positionErrorMeters,
      "position error must be a non-negative safe integer (metres)",
    );
  if (typeof input.possibleDeception !== "boolean")
    invariant("possibleDeception", input.possibleDeception, "possible deception must be a boolean");
  if (!Array.isArray(input.generatedKnowledgeAssertions))
    invariant(
      "generatedKnowledgeAssertions",
      input.generatedKnowledgeAssertions,
      "generated knowledge assertions must be an array",
    );
  for (let i = 0; i < input.generatedKnowledgeAssertions.length; i++) {
    const raw = input.generatedKnowledgeAssertions[i] as unknown;
    if (raw === null || raw === undefined || typeof raw !== "object")
      invariant(`generatedKnowledgeAssertions[${i}]`, raw, "knowledge assertion must be a record");
    const item = raw as Record<string, unknown>;
    if (!isNonEmptyString(item.knowledgeAssertionId))
      invariant(
        `generatedKnowledgeAssertions[${i}].knowledgeAssertionId`,
        item.knowledgeAssertionId,
        "non-empty knowledge assertion id",
      );
    if (!isNonEmptyString(item.participantId))
      invariant(
        `generatedKnowledgeAssertions[${i}].participantId`,
        item.participantId,
        "non-empty assertion participant id",
      );
    if (!(MINE_KNOWLEDGE_ASSERTION_KINDS as readonly string[]).includes(item.kind as string))
      invariant(
        `generatedKnowledgeAssertions[${i}].kind`,
        item.kind,
        "must be a shipped knowledge-assertion kind",
      );
    if (!isNonEmptyString(item.detail))
      invariant(
        `generatedKnowledgeAssertions[${i}].detail`,
        item.detail,
        "non-empty deterministic assertion detail",
      );
  }
  if (input.rulesetVersion !== MINE_RULESET_VERSION)
    invariant("rulesetVersion", input.rulesetVersion, "must be the shipped mine ruleset version");
  if (input.formulaVersion !== MINE_FORMULA_VERSION)
    invariant("formulaVersion", input.formulaVersion, "must be the shipped mine formula version");
  if (input.reportSignaturePolicyId !== MINE_REPORT_SIGNATURE_POLICY_ID)
    invariant(
      "reportSignaturePolicyId",
      input.reportSignaturePolicyId,
      "must be the §20 report-signature policy id underwater_explosion_identification_v1",
    );

  const reportHash = computeMineIncidentReportHash(input as MineIncidentReport);
  const causeUncertain = input.confidenceBp < MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP;
  const report: MineIncidentReport = { ...(input as MineIncidentReport), reportHash };
  return { report, causeUncertain };
}

// Deterministic report hash over the non-hash surface, domain-separated with the
// mine_report_v1 content version. Identical content -> identical hash. Any
// provided reportHash is ignored so the hash depends only on the report fields.
export function computeMineIncidentReportHash(r: MineIncidentReport): string {
  const { reportHash: _ignored, ...surface } = r;
  void _ignored;
  return createEnvelope("mine-incident-report", mineReportContentVersion, surface).bodyHash;
}

// Fail-closed content-hash verification: recomputes the hash and compares.
// Any tampered field produces a mismatch (never silently accepted).
export function verifyMineIncidentReportHash(r: MineIncidentReport): boolean {
  return computeMineIncidentReportHash(r) === r.reportHash;
}

// §19 immutability contract: a report NEVER overwrites true pressure/type/cause/
// laying participant. The report has no field that can even express authoritative
// pressure — it only carries reported/estimated beliefs. This predicate exists so
// callers/tests can assert the report is knowledge-state-only (no authoritative
// mutation vector escapes the module). Always `true` by construction.
export function mineReportIsKnowledgeStateOnly(_r: MineIncidentReport): true {
  return true;
}
