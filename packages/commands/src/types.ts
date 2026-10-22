import type { Diagnostic } from "@bluewave/diagnostics";

export type IssuerClass = "PLAYER" | "AI" | "SYSTEM_AUTOMATION";
export const ISSUER_CLASSES: readonly IssuerClass[] = [
  "PLAYER",
  "AI",
  "SYSTEM_AUTOMATION",
] as const;

export type CommandStatus =
  | "SUBMITTED"
  | "VALIDATED"
  | "AUTHORIZED"
  | "RESERVED"
  | "ACCEPTED"
  | "LOCKED"
  | "RESOLVING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "SUPERSEDED";

export const TERMINAL_STATUSES: ReadonlySet<CommandStatus> = new Set([
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "REJECTED",
  "CANCELLED",
  "SUPERSEDED",
]);

export type CancellationPolicy =
  | "NOT_CANCELLABLE"
  | "UNTIL_LOCK"
  | "UNTIL_IRREVERSIBLE_PHASE"
  | "CUSTOM_EXPLICIT";

export type IdempotencyScope = string;

export interface VolatilePrecondition {
  predicateId: string;
  recheckPhaseId: string;
  failureReasonCode: string;
  partialCompletionAllowed: boolean;
  settlementPolicyBranch: string;
  explanationFields: string[];
}

export interface SupersessionPolicy {
  targetEligibilityPredicate: (target: CommandRecord) => boolean;
  allowedTargetStatuses: CommandStatus[];
  reservationTransferBehavior: "TRANSFER" | "RELEASE_AND_RERESERVE" | "NONE";
  settlementBehavior: string;
  commandOrdering: "SUPERSEDING_FIRST" | "TARGET_FIRST";
  lockBoundaryBehavior: "ALLOW_LOCKED" | "REJECT_LOCKED";
  auditLinkage: boolean;
}

export interface CommandSettlementBranch {
  refundBasisPoints: number;
  fixedNonRefundableAmount: number;
  consumedAmountFormulaId: string;
  releasedAmountFormulaId: string;
  recipientAccount: string;
  ledgerPostingCategory: string;
  roundingMode: "FLOOR" | "CEIL" | "TRUNC" | "HALF_UP";
  explanationReasonCode: string;
}

export type SettlementBranchId =
  | "validationRejection"
  | "authorizationRejection"
  | "reservationFailure"
  | "preLockCancellation"
  | "postLockPreIrreversibleCancellation"
  | "resolutionImpossibilityBeforeEffects"
  | "partialCompletion"
  | "completion"
  | "supersession"
  | "internalResolutionFailure";

export type CommandSettlementPolicy = Record<SettlementBranchId, CommandSettlementBranch | null>;

export interface CommandTypeDefinition {
  readonly commandTypeId: string;
  readonly commandSchemaVersion: string;
  readonly allowedIssuerClasses: IssuerClass[];
  readonly targetAggregateType: string;
  readonly submissionPhaseId: string;
  readonly authorizationPolicyId: string;
  readonly validationPolicyId: string;
  readonly reservationPolicyId: string;
  readonly lockPhaseId: string;
  readonly irreversiblePhaseId: string;
  readonly resolutionPhaseId: string;
  readonly cancellationPolicyId: CancellationPolicy;
  readonly settlementPolicyId: string;
  readonly resultSchemaId: string;
  readonly reasonCodeNamespace: string;
  readonly idempotencyScope: IdempotencyScope;
  readonly owningDesignContractId: string;
  readonly handlerImplementationId: string;
  readonly handlerVersion: string;
  readonly testVectorIds: string[];
  readonly contentHash: string;
  readonly issuerRestrictionReasonCode?: string;
  readonly issuerEligibilityPredicate?: (issuer: IssuerClass, participantId: string) => boolean;
  readonly validationFailurePriority?: Record<string, number>;
  readonly volatilePreconditions?: VolatilePrecondition[];
  readonly partialCompletionAllowed?: boolean;
  readonly divisibleEffectUnits?: string[];
  readonly supersedesCommandTypes?: string[];
  readonly supersessionPolicy?: SupersessionPolicy;
  readonly irreversibleEffectMarkers?: string[];
  readonly settlementPolicy?: CommandSettlementPolicy;
  readonly retryPolicy?: { maxAttempts: number; retryPhaseId?: string };
  readonly allowVersionedExtensions?: boolean;
}

export interface CommandRecord {
  readonly commandId: string;
  readonly commandTypeId: string;
  readonly commandSchemaVersion: string;
  readonly campaignId: string;
  readonly campaignMonth: string;
  readonly issuerClass: IssuerClass;
  readonly issuerParticipantId: string;
  readonly targetAggregateType: string;
  readonly targetAggregateId: string;
  readonly submissionPhaseId: string;
  readonly submissionOrdinal: number;
  readonly idempotencyKey: string;
  readonly canonicalPayload: unknown;
  readonly canonicalPayloadHash: string;
  readonly declaredPreconditions: Record<string, unknown>;
  status: CommandStatus;
  authorizationRecord?: CommandAuthorizationRecord | "NONE";
  validationRecord?: CommandValidationRecord | "NONE";
  reservationRecordIds: string[];
  cancellationRequestId?: string;
  resolutionRecord?: unknown;
  settlementRecord?: CommandSettlementRecord | "NONE";
  resultRecord?: CommandResult | "NONE";
  readonly createdFromSnapshotHash: string;
  lastTransitionAtPhaseId: string;
  readonly causalRecordId: string;
  readonly commandHash: string;
  readonly supersededByCommandId?: string;
  readonly supersedesCommandId?: string;
}

export interface CommandStatusTransitionRecord {
  readonly commandId: string;
  readonly fromStatus: CommandStatus;
  readonly toStatus: CommandStatus;
  readonly phaseId: string;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly previousHash: string;
  readonly recordHash: string;
  readonly timestamp: string;
}

export interface CommandValidationRecord {
  readonly commandId: string;
  readonly validationPolicyId: string;
  readonly validationPolicyVersion: string;
  readonly inputSnapshotHash: string;
  readonly orderedPredicateResults: Array<{
    predicateId: string;
    passed: boolean;
    reasonCode?: string;
  }>;
  readonly canonicalPayloadHash: string;
  readonly validationResult: "PASSED" | "FAILED";
  readonly primaryReasonCode: string;
  readonly diagnosticReasonCodes: string[];
  readonly validationRecordHash: string;
}

export interface CommandAuthorizationRecord {
  readonly commandId: string;
  readonly issuerClass: IssuerClass;
  readonly participantId: string;
  readonly authorized: boolean;
  readonly reasonCode: string;
  readonly checks: Record<string, boolean>;
  readonly recordHash: string;
}

export interface CommandReservationRecord {
  readonly reservationId: string;
  readonly commandId: string;
  readonly resourceTypeId: string;
  readonly resourceId: string;
  readonly reservedQuantity: number;
  readonly canonicalUnit: string;
  readonly reservationStartPhase: string;
  readonly reservationReleaseCondition: string;
  readonly reservationConsumptionPolicy: string;
  readonly reservationPriority: number;
  readonly reservationHash: string;
}

export interface CommandSettlementRecord {
  readonly commandId: string;
  readonly branchId: SettlementBranchId;
  readonly reservedAmount: number;
  readonly consumedAmount: number;
  readonly fixedNonRefundableAmount: number;
  readonly refundBasisPoints: number;
  readonly releasedAmount: number;
  readonly lostAmount: number;
  readonly recipientAccount: string;
  readonly ledgerPostingCategory: string;
  readonly roundingMode: string;
  readonly explanationReasonCode: string;
  readonly settlementHash: string;
}

export interface CommandResult {
  readonly commandId: string;
  readonly terminalStatus: CommandStatus;
  readonly primaryReasonCode: string;
  readonly diagnosticReasonCodes: string[];
  readonly appliedEffectRecordIds: string[];
  readonly reservationSettlementIds: string[];
  readonly refundAmountByResource: Record<string, number>;
  readonly consumedAmountByResource: Record<string, number>;
  readonly lostAmountByResource: Record<string, number>;
  readonly domainEventIds: string[];
  readonly randomDecisionRecordIds: string[];
  readonly preResolutionStateHash: string;
  readonly postResolutionStateHash: string;
  readonly explanationTrace: string[];
  readonly resultHash: string;
}

export interface CommandImpossibilityOutcome {
  readonly commandId: string;
  readonly failedPredicateIds: string[];
  readonly primaryReasonCode: string;
  readonly diagnosticReasonCodes: string[];
  readonly inputSnapshotHash: string;
  readonly effectsAlreadyApplied: string[];
  readonly reservedResourceDisposition: Record<string, string>;
  readonly refundCalculation: Record<string, number>;
  readonly lostCostCalculation: Record<string, number>;
  readonly resultingTerminalStatus: CommandStatus;
  readonly explanationTrace: string[];
}

export interface AuditRecord {
  readonly previousAuditHash: string;
  readonly currentRecordHash: string;
  readonly campaignId: string;
  readonly commandId: string;
  readonly phaseId: string;
  readonly actorId: string;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly policyVersion: string;
  readonly handlerVersion: string;
  readonly reasonCodes: string[];
}

export interface CanonicalCommandOrderKey {
  submissionPhaseOrdinal: number;
  issuerParticipantId: string;
  submissionOrdinal: number;
  commandId: string;
}

export type CommandOutcome =
  | { type: "success"; commandId: string; snapshotHash: string; result?: unknown }
  | { type: "rejected"; commandId: string; snapshotHash: string; diagnostic: Diagnostic }
  | { type: "idempotency_match"; commandId: string; snapshotHash: string; result?: unknown }
  | {
      type: "idempotency_conflict";
      commandId: string;
      snapshotHash: string;
      diagnostic: Diagnostic;
    };

export type LifecycleStepResult = { ok: true } | { ok: false; outcome: CommandOutcome };
