import type { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { PhaseEngineError } from "./errors.js";

export interface LedgerTransaction {
  transactionId: string;
  campaignMonth: string;
  phaseId: string;
  nationId: string;
  categoryId: string;
  debit: SafeInt;
  credit: SafeInt;
  previousBalance: SafeInt;
  newBalance: SafeInt;
  reason: string;
  requested?: SafeInt;
  shortfall?: SafeInt;
  preTransactionHash: string;
  postTransactionHash: string;
}

export type LedgerTransactionInput = Omit<
  LedgerTransaction,
  "transactionId" | "preTransactionHash" | "postTransactionHash"
>;

export class FinancialLedger {
  private transactions: LedgerTransaction[] = [];

  get all(): readonly LedgerTransaction[] {
    return this.transactions;
  }

  append(transaction: LedgerTransactionInput): void {
    if (transaction.debit !== transaction.credit) {
      throw new PhaseEngineError({
        message: `Unbalanced ledger transaction: debit ${String(transaction.debit)} != credit ${String(transaction.credit)}`,
      });
    }

    const preTransactionHash = this.hash();
    const transactionId = `tx-${this.transactions.length}`;
    const tx: LedgerTransaction = {
      ...transaction,
      transactionId,
      preTransactionHash,
      postTransactionHash: "",
    };

    const index = this.transactions.length;
    this.transactions.push(tx);
    this.transactions[index] = {
      ...tx,
      postTransactionHash: this.hash(),
    };
  }

  hash(): string {
    return sha256Hex(canonicalSerialize(this.transactions));
  }

  toJSON(): string {
    return canonicalSerialize(this.transactions);
  }
}
