import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { hashCommandRecord } from "./canonicalization.js";
import type { CommandBody, CommandEnvelope } from "./envelope.js";
import type { CommandRecord, CommandTypeDefinition } from "./types.js";

export function createCommandRecord(
  envelope: CommandEnvelope<CommandBody>,
  definition: CommandTypeDefinition,
  campaignId: string,
  campaignMonth: string,
  issuerClass: CommandRecord["issuerClass"],
  issuerParticipantId: string,
  targetAggregateId: string,
  submissionPhaseId: string,
  submissionOrdinal: number,
  snapshotHash: string,
): CommandRecord {
  const canonicalPayloadHash = sha256Hex(canonicalSerialize(envelope.body));
  const rec: CommandRecord = {
    commandId: envelope.commandId,
    commandTypeId: definition.commandTypeId,
    commandSchemaVersion: definition.commandSchemaVersion,
    campaignId,
    campaignMonth,
    issuerClass,
    issuerParticipantId,
    targetAggregateType: definition.targetAggregateType,
    targetAggregateId,
    submissionPhaseId,
    submissionOrdinal,
    idempotencyKey: envelope.idempotencyKey,
    canonicalPayload: envelope.body,
    canonicalPayloadHash,
    declaredPreconditions: {},
    status: "SUBMITTED",
    authorizationRecord: "NONE",
    validationRecord: "NONE",
    reservationRecordIds: [],
    cancellationRequestId: "NONE",
    resolutionRecord: "NONE",
    settlementRecord: "NONE",
    resultRecord: "NONE",
    createdFromSnapshotHash: snapshotHash,
    lastTransitionAtPhaseId: submissionPhaseId,
    causalRecordId: `causal-${envelope.commandId}`,
    commandHash: "",
  };
  return { ...rec, commandHash: hashCommandRecord(rec) };
}
