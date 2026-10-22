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

export const mineReportContentVersion = "mine_report_v1" as const;

export const MINE_REPORT_CONFIDENCE_MIN_BP = 0 as const;
export const MINE_REPORT_CONFIDENCE_MAX_BP = MINE_BASIS_POINTS_PER_UNIT;

export const MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP = MINE_BASIS_POINTS_PER_UNIT;

export const MINE_REPORT_UNKNOWN = "UNKNOWN" as const;

export const MINE_KNOWLEDGE_ASSERTION_KINDS = [
  "SUSPECTED_MINE_PRESSURE",
  "SUSPECTED_MINE_TYPE",
  "SUSPECTED_LAYING_PARTICIPANT",
  "SUSPECTED_LOCATION",
] as const;
export type MineReportKnowledgeAssertionKind = (typeof MINE_KNOWLEDGE_ASSERTION_KINDS)[number];

export interface MineReportGeneratedKnowledgeAssertion {
  knowledgeAssertionId: string;
  participantId: string;
  kind: MineReportKnowledgeAssertionKind;
  detail: string;
}

export interface MineIncidentReport {
  reportId: string;
  recipientParticipantId: string;
  areaOrRoute: string;
  observedTime: SafeInt;
  receivedTime: SafeInt;
  affectedShipOrForceId: string;
  reportedCause: string;
  estimatedMineType: MineType | typeof MINE_REPORT_UNKNOWN;
  estimatedLayingParticipantId: string;
  confidenceBp: SafeInt;
  positionErrorMeters: SafeInt;
  deliveryDelayMonths: SafeInt;
  possibleDeception: boolean;
  generatedKnowledgeAssertions: readonly MineReportGeneratedKnowledgeAssertion[];
  rulesetVersion: string;
  formulaVersion: string;
  reportSignaturePolicyId: string;
  reportHash: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

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

export function computeMineIncidentReportHash(r: MineIncidentReport): string {
  const { reportHash: _ignored, ...surface } = r;
  void _ignored;
  return createEnvelope("mine-incident-report", mineReportContentVersion, surface).bodyHash;
}

export function verifyMineIncidentReportHash(r: MineIncidentReport): boolean {
  return computeMineIncidentReportHash(r) === r.reportHash;
}

export function mineReportIsKnowledgeStateOnly(_r: MineIncidentReport): true {
  return true;
}
