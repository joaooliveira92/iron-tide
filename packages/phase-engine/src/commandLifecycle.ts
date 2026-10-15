import type { CampaignSlot, CampaignSnapshot } from "@bluewave/campaign";
import { campaignMonthId } from "@bluewave/campaign";
import type { BudgetProjectCommand, CommandEnvelope } from "@bluewave/commands";
import {
  AuditChain,
  CommandLifecycle,
  CommandRegistry,
  ReservationManager,
  canTransition,
  checkCancellationWindow,
  createCommandRecord,
  createSettlementRecord,
  hashCommandRecord,
  produceResult,
  type CommandRecord,
  type CommandResult,
  type CommandSettlementRecord,
  type CommandStatus,
  type CommandStatusTransitionRecord,
  type CommandTypeDefinition,
  type ResourcePool,
  type SettlementBranchId,
} from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { applyBudgetProject } from "./commands.js";
import { PhaseEngineError } from "./errors.js";
import { makeLedgerEntry } from "./events.js";
import type { FinancialLedger } from "./financial-ledger.js";

// ---------------------------------------------------------------------------
// Full CommandRecord lifecycle (ticket 06).
//
// The month pipeline's default path consumes only the success/reject outcome of
// `CommandLifecycle.process` and applies effects through a fixed per-command
// switch, so most of the modeled lifecycle state machine in `@bluewave/commands`
// is scaffolding rather than executing against the snapshot. This module drives
// a real command type — `budget_project` — end-to-end through the full
// `CommandRecord` machine against the *running snapshot*: validation,
// authorization, treasury reservation, lock at the irreversible boundary,
// resolution (real effects via the shared `applyBudgetProject`), and settlement
// onto the financial ledger — producing hash-chained status-transition,
// settlement, and audit records and a terminal `CommandResult`.
//
// Determinism: like the desktop construction workspace, status transitions
// recompute only the deterministic `commandHash` (never the wall-clock-stamping
// `transitionRecord()` helper), the transition chain is built timestamp-free
// and hash-chained, and `AuditChain` / `createSettlementRecord` /
// `ReservationManager` are all deterministic. A replay re-executing the same
// command against the same snapshot reproduces identical outcomes and hashes.
//
// The default month pipeline is deliberately UNCHANGED (goldens byte-identical);
// this is an opt-in full-lifecycle path proven against the actual snapshot.
// ---------------------------------------------------------------------------

export const BUDGET_PROJECT_COMMAND_TYPE_ID = "budget_project";
export const BUDGET_PROJECT_COMMAND_SCHEMA_VERSION = "1.0.0";

/**
 * The single `CommandTypeDefinition` for the real `budget_project` command, with
 * a full settlement policy covering every canonical branch. Registered once in a
 * module-level `CommandRegistry` (append-only; duplicate registration throws).
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

const budgetProjectRegistry = new CommandRegistry();
budgetProjectRegistry.register(BUDGET_PROJECT_COMMAND_DEFINITION);

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

budgetProjectRegistry.register(HALT_CONSTRUCTION_COMMAND_DEFINITION);
budgetProjectRegistry.register(RESUME_CONSTRUCTION_COMMAND_DEFINITION);

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

budgetProjectRegistry.register(SET_ACCELERATION_COMMAND_DEFINITION);

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

budgetProjectRegistry.register(CANCEL_CONSTRUCTION_PROJECT_COMMAND_DEFINITION);

/** Canonical settlement branch id this module walks through on completion. */
export const BUDGET_COMPLETION_BRANCH_ID: SettlementBranchId = "completion";

export interface BudgetProjectLifecycleOutcome {
  /** The terminal, fully-settled command record. */
  record: CommandRecord;
  /** Terminal status (COMPLETED | REJECTED | CANCELLED). */
  terminalStatus: CommandStatus;
  /** The produced `CommandResult` (or null when rejected before resolution). */
  result: CommandResult | null;
  /** Settlement record (or null when no reservation was ever made). */
  settlement: CommandSettlementRecord | null;
  /** The final snapshot after effects (unchanged when the command did not apply effects). */
  snapshot: CampaignSnapshot;
  /** Deterministic hash-chained status-transition records. */
  transitions: readonly CommandStatusTransitionRecord[];
  /** Audit-chain head hash after this command. */
  auditHeadHash: string;
}

/**
 * Drives a `budget_project` command through the full `CommandRecord` lifecycle
 * against a running snapshot. Each invocation is self-contained and
 * deterministic: pools, chains, and ledgers are built fresh.
 */
export class BudgetProjectLifecycle {
  private lifecycle = new CommandLifecycle();
  private registry: CommandRegistry = budgetProjectRegistry;

  /**
   * Resolve a `budget_project` command end-to-end: SUBMITTED → VALIDATED →
   * AUTHORIZED → RESERVED → LOCKED → RESOLVING → COMPLETED, reserving treasury
   * before effects apply and settling the reservation on completion. Effects are
   * applied via the shared `applyBudgetProject` against the real snapshot.
   */
  complete(
    snapshot: CampaignSnapshot,
    envelope: CommandEnvelope<BudgetProjectCommand>,
    slot: CampaignSlot,
    turnNumber: SafeInt,
    financialLedger: FinancialLedger,
    eventLedger: EventLedger,
    collector: DiagnosticCollector,
  ): BudgetProjectLifecycleOutcome {
    const campaignMonth = campaignMonthId(
      snapshot["startYear"],
      snapshot["startMonth"],
      turnNumber as number,
    );
    const audit = new AuditChain();
    const transitions: CommandStatusTransitionRecord[] = [];
    const chain: { previousHash: string } = { previousHash: "0".repeat(64) };
    const reservations = new ReservationManager();
    const treasuryPool = this.treasuryPool(snapshot, envelope.body.nationId);
    if (treasuryPool) reservations.registerPool(treasuryPool);

    const fail = (
      record: CommandRecord | null,
      terminalStatus: CommandStatus,
      reasonCode: string,
      snapshotState: CampaignSnapshot,
    ): BudgetProjectLifecycleOutcome => {
      audit.append(
        snapshot.campaignId,
        envelope.commandId,
        "command_collection",
        slot.nationId,
        envelope.expectedSnapshotHash,
        sha256Hex(canonicalSerialize(snapshotState)),
        "0.1.0",
        "1.0.0",
        [reasonCode],
      );
      // The record reflects its terminal status (REJECTED), not a dangling
      // SUBMITTED: the modeled machine records the terminal status on the record.
      const terminal =
        record === null
          ? this.withStatus(this.makeRecord(snapshot, envelope, slot), terminalStatus)
          : this.withStatus(record, terminalStatus);
      return {
        record: terminal,
        terminalStatus,
        result: null,
        settlement: null,
        snapshot: snapshotState,
        transitions,
        auditHeadHash: audit.headHash,
      };
    };

    // 1) Validate.
    const validation = this.lifecycle.validate(envelope, snapshot);
    if (!validation.ok) {
      return fail(null, "REJECTED", "VALIDATION_REJECTED", snapshot);
    }

    // 2) Authorize.
    const authorization = this.lifecycle.authorize(envelope, slot);
    if (!authorization.ok) {
      return fail(null, "REJECTED", "AUTHORIZATION_REJECTED", snapshot);
    }

    // 3) Create + walk SUBMITTED → VALIDATED → AUTHORIZED.
    let record = this.makeRecord(snapshot, envelope, slot);
    record = this.walk(record, ["VALIDATED", "AUTHORIZED"], transitions, chain, slot);

    const reservedAmount = Number(envelope.body.budget);

    // 4) Reserve treasury before any effect applies.
    if (!treasuryPool) {
      return fail(record, "REJECTED", "NATION_NOT_FOUND", snapshot);
    }
    const reserve = reservations.reserve(
      record,
      [
        {
          resourceTypeId: "TREASURY",
          resourceId: envelope.body.nationId,
          quantity: reservedAmount,
          canonicalUnit: "TREASURY",
          priority: 1,
        },
      ],
      "command_collection",
    );
    if (!reserve.ok) {
      return fail(record, "REJECTED", reserve.reasonCode, snapshot);
    }
    record = { ...record, reservationRecordIds: reserve.records.map((r) => r.reservationId) };

    // 5) Walk RESERVED → ACCEPTED → LOCKED (the irreversible-phase boundary).
    record = this.walk(record, ["RESERVED", "ACCEPTED", "LOCKED"], transitions, chain, slot);

    // 6) Resolve: compute pre-hash, apply real effects, then walk to RESOLVING.
    const preResolutionHash = sha256Hex(canonicalSerialize(snapshot));
    const state = applyBudgetProject(
      snapshot,
      envelope.body,
      campaignMonth,
      turnNumber,
      () => SafeInt(0),
      financialLedger,
      eventLedger,
      collector,
    );
    record = this.walk(record, ["RESOLVING", "COMPLETED"], transitions, chain, slot);
    const postResolutionHash = sha256Hex(canonicalSerialize(state));

    // 7) Settle the reservation onto the ledger (consumed on completion).
    const settlement = this.settle(
      record,
      BUDGET_COMPLETION_BRANCH_ID,
      financialLedger,
      state,
      campaignMonth,
      envelope.body.nationId,
      reservedAmount,
      reservedAmount,
    );
    reservations.release(record.commandId);

    // 8) Produce + attach the terminal CommandResult.
    const result = produceResult(
      record.commandId,
      "COMPLETED",
      "COMMAND_COMPLETED",
      preResolutionHash,
      postResolutionHash,
      settlement ? [settlement.settlementHash] : [],
    );
    record = { ...record, resultRecord: result, settlementRecord: settlement };

    audit.append(
      snapshot.campaignId,
      record.commandId,
      "command_collection",
      slot.nationId,
      preResolutionHash,
      postResolutionHash,
      "0.1.0",
      "1.0.0",
      [result.terminalStatus, result.primaryReasonCode],
    );

    return {
      record,
      terminalStatus: result.terminalStatus,
      result,
      settlement,
      snapshot: state,
      transitions,
      auditHeadHash: audit.headHash,
    };
  }

  /**
   * Cancel a `budget_project` command before the irreversible phase, settling the
   * pre-lock cancellation branch (full refund) and releasing the reservation.
   * A command already past its irreversible phase cannot be cancelled (the
   * designed policy, `UNTIL_IRREVERSIBLE_PHASE`), which the caller can observe
   * via `canCancel`.
   */
  canCancel(
    snapshot: CampaignSnapshot,
    envelope: CommandEnvelope<BudgetProjectCommand>,
    slot: CampaignSlot,
    currentPhaseId: string,
    currentStatus: CommandStatus,
  ): { allowed: boolean; reasonCode: string } {
    const record = this.makeRecord(snapshot, envelope, slot);
    return checkCancellationWindow(record, this.definition(), currentPhaseId, currentStatus);
  }

  /**
   * Cancel a `budget_project` command before the irreversible phase, walking the
   * record to CANCELLED and settling the `preLockCancellation` branch (full
   * refund of the reserved treasury), releasing the reservation. Exercises the
   * settlement-on-rejection path of the modeled machine against the snapshot.
   */
  cancel(
    snapshot: CampaignSnapshot,
    envelope: CommandEnvelope<BudgetProjectCommand>,
    slot: CampaignSlot,
    turnNumber: SafeInt,
    financialLedger: FinancialLedger,
  ): BudgetProjectLifecycleOutcome {
    const campaignMonth = campaignMonthId(
      snapshot["startYear"],
      snapshot["startMonth"],
      turnNumber as number,
    );
    const audit = new AuditChain();
    const transitions: CommandStatusTransitionRecord[] = [];
    const chain: { previousHash: string } = { previousHash: "0".repeat(64) };
    const reservations = new ReservationManager();
    const treasuryPool = this.treasuryPool(snapshot, envelope.body.nationId);
    if (treasuryPool) reservations.registerPool(treasuryPool);

    // Validation + authorization gate a cancellation as much as a completion.
    const validation = this.lifecycle.validate(envelope, snapshot);
    if (!validation.ok)
      return this.rejected(snapshot, envelope, slot, "REJECTED", "VALIDATION_REJECTED");
    const authorization = this.lifecycle.authorize(envelope, slot);
    if (!authorization.ok)
      return this.rejected(snapshot, envelope, slot, "REJECTED", "AUTHORIZATION_REJECTED");

    let record = this.makeRecord(snapshot, envelope, slot);
    record = this.walk(record, ["VALIDATED", "AUTHORIZED"], transitions, chain, slot);

    const reservedAmount = Number(envelope.body.budget);
    if (!treasuryPool)
      return this.rejected(snapshot, envelope, slot, "REJECTED", "NATION_NOT_FOUND");
    const reserve = reservations.reserve(
      record,
      [
        {
          resourceTypeId: "TREASURY",
          resourceId: envelope.body.nationId,
          quantity: reservedAmount,
          canonicalUnit: "TREASURY",
          priority: 1,
        },
      ],
      "command_collection",
    );
    if (!reserve.ok) return this.rejected(snapshot, envelope, slot, "REJECTED", reserve.reasonCode);
    record = { ...record, reservationRecordIds: reserve.records.map((r) => r.reservationId) };

    // Cancel while still accepted (pre-lock / pre-irreversible): walk to
    // CANCELLED and settle the preLockCancellation branch with a full refund.
    record = this.walk(record, ["ACCEPTED", "CANCELLED"], transitions, chain, slot);
    const settlement = this.settle(
      record,
      "preLockCancellation",
      financialLedger,
      snapshot,
      campaignMonth,
      envelope.body.nationId,
      reservedAmount,
      0,
    );
    reservations.release(record.commandId);

    const preHash = sha256Hex(canonicalSerialize(snapshot));
    const result = produceResult(
      record.commandId,
      "CANCELLED",
      "COMMAND_CANCELLED",
      preHash,
      preHash,
      settlement ? [settlement.settlementHash] : [],
    );
    record = { ...record, resultRecord: result, settlementRecord: settlement };

    audit.append(
      snapshot.campaignId,
      record.commandId,
      "command_collection",
      slot.nationId,
      preHash,
      preHash,
      "0.1.0",
      "1.0.0",
      [result.terminalStatus, result.primaryReasonCode],
    );

    return {
      record,
      terminalStatus: result.terminalStatus,
      result,
      settlement,
      snapshot,
      transitions,
      auditHeadHash: audit.headHash,
    };
  }

  private rejected(
    snapshot: CampaignSnapshot,
    envelope: CommandEnvelope<BudgetProjectCommand>,
    slot: CampaignSlot,
    terminalStatus: CommandStatus,
    reasonCode: string,
  ): BudgetProjectLifecycleOutcome {
    const record = this.withStatus(this.makeRecord(snapshot, envelope, slot), terminalStatus);
    const audit = new AuditChain();
    audit.append(
      snapshot.campaignId,
      envelope.commandId,
      "command_collection",
      slot.nationId,
      envelope.expectedSnapshotHash,
      sha256Hex(canonicalSerialize(snapshot)),
      "0.1.0",
      "1.0.0",
      [reasonCode],
    );
    return {
      record,
      terminalStatus,
      result: null,
      settlement: null,
      snapshot,
      transitions: [],
      auditHeadHash: audit.headHash,
    };
  }

  /** Walk a record through `statuses`, building a deterministic hash-chained
   *  transition ledger (shared running chain across walk calls) and recomputing
   *  `commandHash` at every hop. */
  private walk(
    record: CommandRecord,
    statuses: CommandStatus[],
    transitions: CommandStatusTransitionRecord[],
    chain: { previousHash: string },
    slot: CampaignSlot,
  ): CommandRecord {
    let current = record;
    for (const next of statuses) {
      if (!canTransition(current.status, next)) {
        throw new PhaseEngineError({
          message: `INVALID_COMMAND_STATUS_TRANSITION: ${current.status} -> ${next}`,
          code: "INVALID_COMMAND_STATUS_TRANSITION",
        });
      }
      const tr: CommandStatusTransitionRecord = {
        commandId: current.commandId,
        fromStatus: current.status,
        toStatus: next,
        phaseId: this.definition().submissionPhaseId,
        actorId: slot.nationId,
        reasonCode: next,
        previousHash: chain.previousHash,
        recordHash: "",
        timestamp: "",
      };
      const recordHash = sha256Hex(canonicalSerialize(tr));
      transitions.push({ ...tr, recordHash });
      chain.previousHash = recordHash;
      current = { ...current, status: next };
      current = { ...current, commandHash: hashCommandRecord(current) };
    }
    return current;
  }

  private settle(
    record: CommandRecord,
    branch: SettlementBranchId,
    ledger: FinancialLedger,
    snapshot: CampaignSnapshot,
    campaignMonth: string,
    nationId: string,
    reservedAmount: number,
    consumedAmount: number,
  ): CommandSettlementRecord {
    const branchDef = this.definition().settlementPolicy?.[branch];
    const settlement = createSettlementRecord(
      record.commandId,
      branch,
      branchDef ?? {
        refundBasisPoints: 10000,
        fixedNonRefundableAmount: 0,
        consumedAmountFormulaId: "NONE",
        releasedAmountFormulaId: "FULL_REFUND",
        recipientAccount: "TREASURY",
        ledgerPostingCategory: "REFUND",
        roundingMode: "FLOOR",
        explanationReasonCode: "COMMAND_SETTLED",
      },
      reservedAmount,
      consumedAmount,
    );
    // Balanced settlement posting onto the financial ledger: records the branch,
    // reserved/consumed/released accounting without a second treasury change
    // (the effect already netted treasury via `applyBudgetProject`).
    const nation = snapshot["nations"].get(nationId);
    const balance = nation ? nation["treasury"] : (0 as SafeInt);
    ledger.append(
      makeLedgerEntry(
        nationId,
        "command_lifecycle",
        "COMMAND_SETTLEMENT",
        settlement.reservedAmount as SafeInt,
        settlement.reservedAmount as SafeInt,
        balance,
        balance,
        `Command ${record.commandId} settlement (${settlement.branchId}): reserved=${settlement.reservedAmount} consumed=${settlement.consumedAmount} released=${settlement.releasedAmount}`,
        campaignMonth,
      ),
    );
    return settlement;
  }

  private treasuryPool(snapshot: CampaignSnapshot, nationId: string): ResourcePool | null {
    const nation = snapshot["nations"].get(nationId);
    if (!nation) return null;
    return {
      resourceTypeId: "TREASURY",
      resourceId: nationId,
      available: Number(nation["treasury"]),
      reserved: new Map(),
    };
  }

  private definition(): CommandTypeDefinition {
    return BUDGET_PROJECT_COMMAND_DEFINITION;
  }

  private makeRecord(
    snapshot: CampaignSnapshot,
    envelope: CommandEnvelope<BudgetProjectCommand>,
    slot: CampaignSlot,
  ): CommandRecord {
    const campaignMonth = campaignMonthId(
      snapshot["startYear"],
      snapshot["startMonth"],
      snapshot["turnNumber"] as number,
    );
    return createCommandRecord(
      envelope,
      this.definition(),
      snapshot.campaignId,
      campaignMonth,
      envelope.issuerClass ?? "PLAYER",
      envelope.issuerParticipantId ?? slot.nationId,
      envelope.body.nationId,
      this.definition().submissionPhaseId,
      1,
      envelope.expectedSnapshotHash,
    );
  }

  /** Immutable status assignment + deterministic `commandHash` recomputation. */
  private withStatus(record: CommandRecord, status: CommandStatus): CommandRecord {
    const next: CommandRecord = { ...record, status };
    return { ...next, commandHash: hashCommandRecord(next) };
  }
}
