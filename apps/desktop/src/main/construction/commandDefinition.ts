import {
  CommandRegistry,
  type CommandSettlementBranch,
  type CommandTypeDefinition,
} from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

export const CONSTRUCTION_COMMAND_TYPE_ID = "construction_order";
export const CONSTRUCTION_COMMAND_SCHEMA_VERSION = "1.0.0";

export const CONSTRUCTION_SETTLEMENT_BRANCH_ID = "preLockCancellation" as const;

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

export function getConstructionCommandRegistry(): CommandRegistry {
  return constructionCommandRegistry;
}
