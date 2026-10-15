import {
  CommandRegistry,
  type CommandSettlementBranch,
  type CommandTypeDefinition,
} from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

/**
 * The construction command's contract facts: its type/schema identity, its
 * single `CommandTypeDefinition`, and the one settlement branch every
 * cancel/replace walks through. Isolating them here means a change to the
 * command contract (a new schema version, a new settlement policy) has exactly
 * one file to change — the workspace lifecycle and the command flows stay put.
 */

export const CONSTRUCTION_COMMAND_TYPE_ID = "construction_order";
export const CONSTRUCTION_COMMAND_SCHEMA_VERSION = "1.0.0";

/**
 * The settlement branch every cancel/replace walks through. `"preLockCancellation"`
 * is one of the machinery's canonical `SettlementBranchId`s; "pre-lock" is
 * exactly the window constructions live in (nothing is locked/irreversible
 * until the monthly appropriation spends against a project).
 */
export const CONSTRUCTION_SETTLEMENT_BRANCH_ID = "preLockCancellation" as const;

/**
 * One branch for every cancellation/supersession: constructions reserve
 * (projected) treasury/drydock; nothing is consumed before the monthly
 * appropriation pipeline actually spends, so a refund is a full release —
 * 10000 basis points, no fixed fee.
 */
export const CONSTRUCTION_REFUND_BRANCH: CommandSettlementBranch = {
  refundBasisPoints: 10000,
  fixedNonRefundableAmount: 0,
  consumedAmountFormulaId: "NONE",
  releasedAmountFormulaId: "FULL_REFUND",
  recipientAccount: "TREASURY",
  ledgerPostingCategory: "REFUND",
  roundingMode: "FLOOR",
  explanationReasonCode: "COMMAND_CANCELLED",
};

/**
 * The single `CommandTypeDefinition` for construction orders. Registered
 * once in a module-level `CommandRegistry` (append-only; duplicate
 * registrations throw, so this is safe at import time).
 */
export const CONSTRUCTION_COMMAND_DEFINITION: CommandTypeDefinition = {
  commandTypeId: CONSTRUCTION_COMMAND_TYPE_ID,
  commandSchemaVersion: CONSTRUCTION_COMMAND_SCHEMA_VERSION,
  allowedIssuerClasses: ["PLAYER"],
  targetAggregateType: "nation",
  submissionPhaseId: "construction_submission",
  authorizationPolicyId: "player_nation_self",
  validationPolicyId: "construction_order_validation",
  reservationPolicyId: "treasury_and_capacity_reservation",
  lockPhaseId: "monthly_commitment_lock",
  irreversiblePhaseId: "construction_irreversible_phase",
  resolutionPhaseId: "construction_acceptance",
  cancellationPolicyId: "UNTIL_LOCK",
  settlementPolicyId: "construction_order_settlement",
  resultSchemaId: "construction_acceptance_result",
  reasonCodeNamespace: "construction",
  idempotencyScope: "campaign:construction",
  owningDesignContractId: "bluewave:construction-order:v1",
  handlerImplementationId: "desktop/construction-commands/v1",
  handlerVersion: "1.0.0",
  testVectorIds: [],
  contentHash: sha256Hex(
    canonicalSerialize({ commandTypeId: CONSTRUCTION_COMMAND_TYPE_ID, version: "1.0.0" }),
  ),
};

const constructionCommandRegistry = new CommandRegistry();
constructionCommandRegistry.register(CONSTRUCTION_COMMAND_DEFINITION);

/** The shared, append-only registry checking every construction workspace. */
export function getConstructionCommandRegistry(): CommandRegistry {
  return constructionCommandRegistry;
}
