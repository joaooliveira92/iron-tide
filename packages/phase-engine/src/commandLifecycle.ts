import type { CommandTypeDefinition } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

// Command type definitions (ticket 06). The month pipeline resolves these
// through `CommandLifecycle.process` in `commandPhases.ts`; there is no second
// lifecycle lane here.

export const BUDGET_PROJECT_COMMAND_TYPE_ID = "budget_project";
export const BUDGET_PROJECT_COMMAND_SCHEMA_VERSION = "1.0.0";

/**
 * The single `CommandTypeDefinition` for the real `budget_project` command, with
 * a full settlement policy covering every canonical branch.
 */
export const BUDGET_PROJECT_COMMAND_DEFINITION: CommandTypeDefinition = {
  commandTypeId: BUDGET_PROJECT_COMMAND_TYPE_ID,
  commandSchemaVersion: BUDGET_PROJECT_COMMAND_SCHEMA_VERSION,
  allowedIssuerClasses: ["PLAYER", "AI"],
  targetAggregateType: "nation",
  submissionPhaseId: "command_collection",
  authorizationPolicyId: "player_nation_self",
  validationPolicyId: "budget_project_validation",
  reservationPolicyId: "treasury_reservation",
  lockPhaseId: "command_collection_lock",
  irreversiblePhaseId: "appropriation",
  resolutionPhaseId: "command_collection_resolution",
  cancellationPolicyId: "UNTIL_IRREVERSIBLE_PHASE",
  settlementPolicyId: "budget_project_settlement",
  resultSchemaId: "budget_project_acceptance_result",
  reasonCodeNamespace: "budget",
  idempotencyScope: "campaign:budget_project",
  owningDesignContractId: "bluewave:budget-project:v1",
  handlerImplementationId: "phase-engine/budget-project-commands/v1",
  handlerVersion: "1.0.0",
  testVectorIds: [],
  contentHash: sha256Hex(
    canonicalSerialize({
      commandTypeId: BUDGET_PROJECT_COMMAND_TYPE_ID,
      version: BUDGET_PROJECT_COMMAND_SCHEMA_VERSION,
    }),
  ),
  settlementPolicy: {
    validationRejection: null,
    authorizationRejection: null,
    reservationFailure: null,
    preLockCancellation: {
      refundBasisPoints: 10000,
      fixedNonRefundableAmount: 0,
      consumedAmountFormulaId: "NONE",
      releasedAmountFormulaId: "FULL_REFUND",
      recipientAccount: "TREASURY",
      ledgerPostingCategory: "REFUND",
      roundingMode: "FLOOR",
      explanationReasonCode: "COMMAND_CANCELLED",
    },
    postLockPreIrreversibleCancellation: {
      refundBasisPoints: 10000,
      fixedNonRefundableAmount: 0,
      consumedAmountFormulaId: "NONE",
      releasedAmountFormulaId: "FULL_REFUND",
      recipientAccount: "TREASURY",
      ledgerPostingCategory: "REFUND",
      roundingMode: "FLOOR",
      explanationReasonCode: "COMMAND_CANCELLED",
    },
    resolutionImpossibilityBeforeEffects: {
      refundBasisPoints: 10000,
      fixedNonRefundableAmount: 0,
      consumedAmountFormulaId: "NONE",
      releasedAmountFormulaId: "FULL_ROLLBACK",
      recipientAccount: "TREASURY",
      ledgerPostingCategory: "ROLLBACK",
      roundingMode: "FLOOR",
      explanationReasonCode: "VOLATILE_PRECONDITION_FAILED",
    },
    partialCompletion: {
      refundBasisPoints: 10000,
      fixedNonRefundableAmount: 0,
      consumedAmountFormulaId: "ACTUAL_CONSUMED",
      releasedAmountFormulaId: "REMAINDER",
      recipientAccount: "TREASURY",
      ledgerPostingCategory: "SETTLEMENT",
      roundingMode: "FLOOR",
      explanationReasonCode: "COMMAND_PARTIALLY_COMPLETED",
    },
    completion: {
      refundBasisPoints: 10000,
      fixedNonRefundableAmount: 0,
      consumedAmountFormulaId: "ACTUAL_CONSUMED",
      releasedAmountFormulaId: "REMAINDER",
      recipientAccount: "TREASURY",
      ledgerPostingCategory: "SETTLEMENT",
      roundingMode: "FLOOR",
      explanationReasonCode: "COMMAND_COMPLETED",
    },
    supersession: {
      refundBasisPoints: 10000,
      fixedNonRefundableAmount: 0,
      consumedAmountFormulaId: "NONE",
      releasedAmountFormulaId: "FULL_REFUND",
      recipientAccount: "TREASURY",
      ledgerPostingCategory: "REFUND",
      roundingMode: "FLOOR",
      explanationReasonCode: "COMMAND_SUPERSEDED",
    },
    internalResolutionFailure: null,
  },
};

export const HALT_CONSTRUCTION_COMMAND_TYPE_ID = "HaltConstruction" as const;
export const HALT_CONSTRUCTION_COMMAND_SCHEMA_VERSION = "1.0.0" as const;
export const RESUME_CONSTRUCTION_COMMAND_TYPE_ID = "ResumeConstruction" as const;
export const RESUME_CONSTRUCTION_COMMAND_SCHEMA_VERSION = "1.0.0" as const;

/** The modeled definition of a construction-status command (halt/resume): no reservation, one locked status write. */
function dockyardStatusDefinition(
  commandTypeId:
    | typeof HALT_CONSTRUCTION_COMMAND_TYPE_ID
    | typeof RESUME_CONSTRUCTION_COMMAND_TYPE_ID,
  schemaVersion: string,
): CommandTypeDefinition {
  return {
    commandTypeId,
    commandSchemaVersion: schemaVersion,
    allowedIssuerClasses: ["PLAYER", "AI"],
    targetAggregateType: "construction",
    submissionPhaseId: "command_collection",
    authorizationPolicyId: "player_nation_self",
    validationPolicyId: "dockyard_status_validation",
    reservationPolicyId: "none",
    lockPhaseId: "command_collection_lock",
    irreversiblePhaseId: "command_collection",
    resolutionPhaseId: "command_collection_resolution",
    cancellationPolicyId: "UNTIL_IRREVERSIBLE_PHASE",
    settlementPolicyId: "dockyard_status_settlement",
    resultSchemaId: "dockyard_status_acceptance_result",
    reasonCodeNamespace: "construction",
    idempotencyScope: `campaign:${commandTypeId}`,
    owningDesignContractId: "bluewave:halt-resume-construction:v1",
    handlerImplementationId: "phase-engine/halt-resume-construction-commands/v1",
    handlerVersion: "1.0.0",
    testVectorIds: [],
    contentHash: sha256Hex(canonicalSerialize({ commandTypeId, version: schemaVersion })),
  };
}

export const HALT_CONSTRUCTION_COMMAND_DEFINITION: CommandTypeDefinition = dockyardStatusDefinition(
  HALT_CONSTRUCTION_COMMAND_TYPE_ID,
  HALT_CONSTRUCTION_COMMAND_SCHEMA_VERSION,
);
export const RESUME_CONSTRUCTION_COMMAND_DEFINITION: CommandTypeDefinition =
  dockyardStatusDefinition(
    RESUME_CONSTRUCTION_COMMAND_TYPE_ID,
    RESUME_CONSTRUCTION_COMMAND_SCHEMA_VERSION,
  );

export const SET_ACCELERATION_COMMAND_TYPE_ID = "SetAcceleration" as const;
export const SET_ACCELERATION_COMMAND_SCHEMA_VERSION = "1.0.0" as const;

/**
 * The modeled definition of the `SetAcceleration` command (DESIGN-23 section 8; DESIGN-13 section 11.3): like halt
 * and resume it is a locked status write with no reservation, but it additionally applies the one-time
 * remaining-work premium when the month runs the command.
 */
export const SET_ACCELERATION_COMMAND_DEFINITION: CommandTypeDefinition = {
  commandTypeId: SET_ACCELERATION_COMMAND_TYPE_ID,
  commandSchemaVersion: SET_ACCELERATION_COMMAND_SCHEMA_VERSION,
  allowedIssuerClasses: ["PLAYER", "AI"],
  targetAggregateType: "construction",
  submissionPhaseId: "command_collection",
  authorizationPolicyId: "player_nation_self",
  validationPolicyId: "acceleration_validation",
  reservationPolicyId: "none",
  lockPhaseId: "command_collection_lock",
  irreversiblePhaseId: "command_collection",
  resolutionPhaseId: "command_collection_resolution",
  cancellationPolicyId: "UNTIL_IRREVERSIBLE_PHASE",
  settlementPolicyId: "dockyard_status_settlement",
  resultSchemaId: "dockyard_status_acceptance_result",
  reasonCodeNamespace: "construction",
  idempotencyScope: `campaign:${SET_ACCELERATION_COMMAND_TYPE_ID}`,
  owningDesignContractId: "bluewave:construction-acceleration:v1",
  handlerImplementationId: "phase-engine/construction-acceleration-commands/v1",
  handlerVersion: "1.0.0",
  testVectorIds: [],
  contentHash: sha256Hex(
    canonicalSerialize({
      commandTypeId: SET_ACCELERATION_COMMAND_TYPE_ID,
      version: SET_ACCELERATION_COMMAND_SCHEMA_VERSION,
    }),
  ),
};

export const CANCEL_CONSTRUCTION_PROJECT_COMMAND_TYPE_ID = "CancelConstructionProject" as const;
export const CANCEL_CONSTRUCTION_PROJECT_COMMAND_SCHEMA_VERSION = "1.0.0" as const;

/**
 * The modeled definition of the `CancelConstructionProject` command (DESIGN-23 section 23; DESIGN-11 section 13). Like
 * halt/resume it is a locked status write with no treasury reservation, so it is not itself cancellable
 * (`NOT_CANCELLABLE`). The settlement it applies is the project's own work settlement, recorded as the
 * `ConstructionProjectCancelled` event rather than a command reservation refund (funding is pay-as-you-go).
 */
export const CANCEL_CONSTRUCTION_PROJECT_COMMAND_DEFINITION: CommandTypeDefinition = {
  commandTypeId: CANCEL_CONSTRUCTION_PROJECT_COMMAND_TYPE_ID,
  commandSchemaVersion: CANCEL_CONSTRUCTION_PROJECT_COMMAND_SCHEMA_VERSION,
  allowedIssuerClasses: ["PLAYER", "AI"],
  targetAggregateType: "construction",
  submissionPhaseId: "command_collection",
  authorizationPolicyId: "player_nation_self",
  validationPolicyId: "cancel_construction_project_validation",
  reservationPolicyId: "none",
  lockPhaseId: "command_collection_lock",
  irreversiblePhaseId: "command_collection",
  resolutionPhaseId: "command_collection_resolution",
  cancellationPolicyId: "NOT_CANCELLABLE",
  settlementPolicyId: "construction_cancellation_settlement",
  resultSchemaId: "cancel_construction_project_result",
  reasonCodeNamespace: "construction",
  idempotencyScope: `campaign:${CANCEL_CONSTRUCTION_PROJECT_COMMAND_TYPE_ID}`,
  owningDesignContractId: "bluewave:cancel-construction-project:v1",
  handlerImplementationId: "phase-engine/cancel-construction-project-commands/v1",
  handlerVersion: "1.0.0",
  testVectorIds: [],
  contentHash: sha256Hex(
    canonicalSerialize({
      commandTypeId: CANCEL_CONSTRUCTION_PROJECT_COMMAND_TYPE_ID,
      version: CANCEL_CONSTRUCTION_PROJECT_COMMAND_SCHEMA_VERSION,
    }),
  ),
};
