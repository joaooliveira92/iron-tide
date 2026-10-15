import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { hashCommandRecord } from "./canonicalization.js";
import type { CommandBody, CommandEnvelope } from "./envelope.js";
import { CommandError } from "./errors.js";
import type {
  CommandImpossibilityOutcome,
  CommandRecord,
  CommandResult,
  CommandStatus,
  CommandTypeDefinition,
} from "./types.js";
import { TERMINAL_STATUSES } from "./types.js";

// --- Spec-compliant command record / result construction and invariants ---

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

export function enforceLockImmutability(rec: CommandRecord, attemptedMutation: string): never {
  if (rec.status === "LOCKED" || rec.status === "RESOLVING") {
    throw new CommandError({
      code: "LOCKED_COMMAND_IMMUTABLE",
      message: `LOCKED_COMMAND_IMMUTABLE: cannot ${attemptedMutation} on ${rec.status} command ${rec.commandId}`,
    });
  }
  throw new CommandError({
    code: "LOCKED_COMMAND_IMMUTABLE",
    message: `LOCKED_COMMAND_IMMUTABLE`,
  });
}

export function checkCancellationWindow(
  rec: CommandRecord,
  def: CommandTypeDefinition,
  currentPhaseId: string,
  currentStatus: CommandStatus,
): { allowed: boolean; reasonCode: string } {
  if (TERMINAL_STATUSES.has(currentStatus))
    return { allowed: false, reasonCode: "CANCELLATION_NOT_ALLOWED" };
  if (def.cancellationPolicyId === "NOT_CANCELLABLE")
    return { allowed: false, reasonCode: "CANCELLATION_NOT_ALLOWED" };
  if (def.cancellationPolicyId === "UNTIL_LOCK") {
    const allowedStatuses: CommandStatus[] = [
      "SUBMITTED",
      "VALIDATED",
      "AUTHORIZED",
      "RESERVED",
      "ACCEPTED",
    ];
    if (!allowedStatuses.includes(currentStatus))
      return { allowed: false, reasonCode: "CANCELLATION_WINDOW_CLOSED" };
    return { allowed: true, reasonCode: "COMMAND_CANCELLED" };
  }
  if (def.cancellationPolicyId === "UNTIL_IRREVERSIBLE_PHASE") {
    if (currentPhaseId === def.irreversiblePhaseId)
      return { allowed: false, reasonCode: "IRREVERSIBLE_EFFECT_ALREADY_APPLIED" };
    // also check status
    const allowed: CommandStatus[] = [
      "SUBMITTED",
      "VALIDATED",
      "AUTHORIZED",
      "RESERVED",
      "ACCEPTED",
      "LOCKED",
      "RESOLVING",
    ];
    if (!allowed.includes(currentStatus))
      return { allowed: false, reasonCode: "CANCELLATION_WINDOW_CLOSED" };
    return { allowed: true, reasonCode: "COMMAND_CANCELLED" };
  }
  // CUSTOM_EXPLICIT - delegate to handler branch (here we allow but require explicit)
  return { allowed: false, reasonCode: "CANCELLATION_NOT_ALLOWED" };
}

export function produceResult(
  commandId: string,
  terminalStatus: CommandStatus,
  primaryReasonCode: string,
  preHash: string,
  postHash: string,
  settlementIds: string[],
): CommandResult {
  const res: CommandResult = {
    commandId,
    terminalStatus,
    primaryReasonCode,
    diagnosticReasonCodes: [],
    appliedEffectRecordIds: [],
    reservationSettlementIds: settlementIds,
    refundAmountByResource: {},
    consumedAmountByResource: {},
    lostAmountByResource: {},
    domainEventIds: [],
    randomDecisionRecordIds: [],
    preResolutionStateHash: preHash,
    postResolutionStateHash: postHash,
    explanationTrace: [primaryReasonCode],
    resultHash: "",
  };
  return { ...res, resultHash: sha256Hex(canonicalSerialize(res)) };
}

export function handleImpossibility(
  command: CommandRecord,
  failedPredicateIds: string[],
  inputSnapshotHash: string,
  effectsApplied: string[],
  def: CommandTypeDefinition,
): { outcome: CommandImpossibilityOutcome; terminalStatus: CommandStatus } {
  const allowsPartial = def.partialCompletionAllowed === true && effectsApplied.length > 0;
  const terminalStatus: CommandStatus =
    effectsApplied.length === 0 ? "REJECTED" : allowsPartial ? "PARTIALLY_COMPLETED" : "REJECTED";
  const outcome: CommandImpossibilityOutcome = {
    commandId: command.commandId,
    failedPredicateIds,
    primaryReasonCode: "VOLATILE_PRECONDITION_FAILED",
    diagnosticReasonCodes: failedPredicateIds,
    inputSnapshotHash,
    effectsAlreadyApplied: effectsApplied,
    reservedResourceDisposition: {},
    refundCalculation: {},
    lostCostCalculation: {},
    resultingTerminalStatus: terminalStatus,
    explanationTrace: [`Volatile precondition failed: ${failedPredicateIds.join(",")}`],
  };
  return { outcome, terminalStatus };
}

// Architecture validation: direct mutation prohibited
export function assertNoDirectMutation(caller: string): void {
  const prohibited = [
    "DTO",
    "UI handler",
    "AI planner",
    "preload bridge",
    "renderer",
    "IPC handler",
    "CommandEnvelope",
  ];
  if (prohibited.some((p) => caller.includes(p))) {
    throw new CommandError({
      code: "DIRECT_COMMAND_STATE_MUTATION_PROHIBITED",
      message: `DIRECT_COMMAND_STATE_MUTATION_PROHIBITED: ${caller} must not mutate authoritative state`,
    });
  }
}

// Failure atomicity
export function handleInternalFailure(
  command: CommandRecord,
  preHash: string,
  _error: unknown,
): CommandResult {
  // roll back is caller's responsibility; here we produce result
  return produceResult(
    command.commandId,
    "REJECTED",
    "COMMAND_RESOLUTION_INTERNAL_FAILURE",
    preHash,
    preHash,
    [],
  );
}

// Replay verification
export function verifyReplay(expected: CommandResult, actual: CommandResult): void {
  if (
    expected.resultHash !== actual.resultHash ||
    expected.terminalStatus !== actual.terminalStatus
  ) {
    throw new CommandError({
      code: "COMMAND_REPLAY_MISMATCH",
      message: `COMMAND_REPLAY_MISMATCH: expected ${expected.resultHash} got ${actual.resultHash}`,
    });
  }
}
