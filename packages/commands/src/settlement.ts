import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { CommandError } from "./errors.js";
import type {
  CommandSettlementBranch,
  CommandSettlementRecord,
  SettlementBranchId,
} from "./types.js";

export function computeSettlement(
  reservedAmount: number,
  consumedAmount: number,
  fixedNonRefundableAmount: number,
  refundBasisPoints: number,
): { releasedAmount: number; lostAmount: number } {
  if (
    !Number.isInteger(reservedAmount) ||
    !Number.isInteger(consumedAmount) ||
    !Number.isInteger(fixedNonRefundableAmount)
  ) {
    throw new CommandError({
      message: "INCOMPLETE_COMMAND_SETTLEMENT_POLICY: amounts must be integers",
    });
  }
  if (reservedAmount < 0 || consumedAmount < 0 || fixedNonRefundableAmount < 0)
    throw new CommandError({ message: "amounts must be non-negative" });
  if (refundBasisPoints < 0 || refundBasisPoints > 10000)
    throw new CommandError({ message: "refundBasisPoints out of range" });
  // Spec: max(0, reserved - consumed - fixed) absorbs any overage.
  const base = Math.max(0, reservedAmount - consumedAmount - fixedNonRefundableAmount);
  const releasedAmount = Math.floor((base * refundBasisPoints) / 10000);
  const lostAmount = reservedAmount - consumedAmount - releasedAmount;
  if (releasedAmount < 0 || lostAmount < 0)
    throw new CommandError({ message: "settlement produced negative" });
  if (consumedAmount + releasedAmount + lostAmount !== reservedAmount)
    throw new CommandError({
      message: "INCOMPLETE_COMMAND_SETTLEMENT_POLICY: settlement must sum to reservedAmount",
    });
  return { releasedAmount, lostAmount };
}

export function createSettlementRecord(
  commandId: string,
  branchId: SettlementBranchId,
  branch: CommandSettlementBranch,
  reservedAmount: number,
  consumedAmount: number,
): CommandSettlementRecord {
  const { releasedAmount, lostAmount } = computeSettlement(
    reservedAmount,
    consumedAmount,
    branch.fixedNonRefundableAmount,
    branch.refundBasisPoints,
  );
  const rec: CommandSettlementRecord = {
    commandId,
    branchId,
    reservedAmount,
    consumedAmount,
    fixedNonRefundableAmount: branch.fixedNonRefundableAmount,
    refundBasisPoints: branch.refundBasisPoints,
    releasedAmount,
    lostAmount,
    recipientAccount: branch.recipientAccount,
    ledgerPostingCategory: branch.ledgerPostingCategory,
    roundingMode: branch.roundingMode,
    explanationReasonCode: branch.explanationReasonCode,
    settlementHash: "",
  };
  return { ...rec, settlementHash: sha256Hex(canonicalSerialize(rec)) };
}

export const DEFAULT_SETTLEMENT_BRANCHES: Record<string, CommandSettlementBranch> = {
  validationRejection: {
    refundBasisPoints: 10000,
    fixedNonRefundableAmount: 0,
    consumedAmountFormulaId: "NONE",
    releasedAmountFormulaId: "FULL_REFUND",
    recipientAccount: "TREASURY",
    ledgerPostingCategory: "REFUND",
    roundingMode: "FLOOR",
    explanationReasonCode: "COMMAND_COMPLETED",
  },
  authorizationRejection: {
    refundBasisPoints: 10000,
    fixedNonRefundableAmount: 0,
    consumedAmountFormulaId: "NONE",
    releasedAmountFormulaId: "FULL_REFUND",
    recipientAccount: "TREASURY",
    ledgerPostingCategory: "REFUND",
    roundingMode: "FLOOR",
    explanationReasonCode: "COMMAND_COMPLETED",
  },
  reservationFailure: {
    refundBasisPoints: 10000,
    fixedNonRefundableAmount: 0,
    consumedAmountFormulaId: "NONE",
    releasedAmountFormulaId: "FULL_ROLLBACK",
    recipientAccount: "TREASURY",
    ledgerPostingCategory: "ROLLBACK",
    roundingMode: "FLOOR",
    explanationReasonCode: "RESERVATION_FAILED",
  },
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
  internalResolutionFailure: {
    refundBasisPoints: 10000,
    fixedNonRefundableAmount: 0,
    consumedAmountFormulaId: "NONE",
    releasedAmountFormulaId: "FULL_REFUND",
    recipientAccount: "TREASURY",
    ledgerPostingCategory: "REFUND",
    roundingMode: "FLOOR",
    explanationReasonCode: "COMMAND_RESOLUTION_INTERNAL_FAILURE",
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
};

export function validateSettlementPolicy(
  policy: Record<string, CommandSettlementBranch | null> | undefined,
): boolean {
  if (!policy) return false;
  const required: SettlementBranchId[] = [
    "validationRejection",
    "authorizationRejection",
    "reservationFailure",
    "preLockCancellation",
    "postLockPreIrreversibleCancellation",
    "resolutionImpossibilityBeforeEffects",
    "partialCompletion",
    "completion",
    "supersession",
    "internalResolutionFailure",
  ];
  for (const b of required) {
    const branch = policy[b];
    if (!branch) {
      // defaults allowed only for subset per spec
      if (
        [
          "validationRejection",
          "authorizationRejection",
          "reservationFailure",
          "preLockCancellation",
          "internalResolutionFailure",
          "completion",
        ].includes(b)
      )
        continue;
      throw new CommandError({
        code: "INCOMPLETE_COMMAND_SETTLEMENT_POLICY",
        message: `INCOMPLETE_COMMAND_SETTLEMENT_POLICY: missing branch ${b}`,
      });
    }
    if (branch.refundBasisPoints < 0 || branch.refundBasisPoints > 10000)
      throw new CommandError({
        code: "INCOMPLETE_COMMAND_SETTLEMENT_POLICY",
        message: `INCOMPLETE_COMMAND_SETTLEMENT_POLICY: refundBasisPoints out of range for ${b}`,
      });
  }
  return true;
}
