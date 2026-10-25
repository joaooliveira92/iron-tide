import type { CampaignSlot, CampaignSnapshot } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCode } from "@bluewave/diagnostics";
import { AuditChain } from "./audit.js";
import type { BudgetProjectCommand, CommandBody, CommandEnvelope } from "./envelope.js";
import { CommandError } from "./errors.js";
import { validatePayloadRules } from "./payloadValidation.js";
import type {
  CommandOutcome,
  CommandRecord,
  CommandStatus,
  CommandStatusTransitionRecord,
  CommandTypeDefinition,
  LifecycleStepResult,
} from "./types.js";
import { TERMINAL_STATUSES } from "./types.js";
import { rejectValidation } from "./validation.js";

export const PERMITTED_TRANSITIONS: Record<CommandStatus, CommandStatus[]> = {
  SUBMITTED: ["VALIDATED", "REJECTED", "CANCELLED"],
  VALIDATED: ["AUTHORIZED", "REJECTED", "CANCELLED"],
  AUTHORIZED: ["RESERVED", "ACCEPTED", "REJECTED", "CANCELLED"],
  RESERVED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["LOCKED", "CANCELLED", "SUPERSEDED"],
  LOCKED: ["RESOLVING", "SUPERSEDED"],
  RESOLVING: ["COMPLETED", "PARTIALLY_COMPLETED", "REJECTED", "CANCELLED", "SUPERSEDED"],
  COMPLETED: [],
  PARTIALLY_COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

export function canTransition(
  from: CommandStatus,
  to: CommandStatus,
  def?: CommandTypeDefinition,
): boolean {
  const allowed = PERMITTED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) return false;
  if (from === "LOCKED" && to === "SUPERSEDED") {
    if (!def?.supersessionPolicy || def.supersessionPolicy.lockBoundaryBehavior !== "ALLOW_LOCKED")
      return false;
  }
  return true;
}

export function transitionRecord(
  rec: CommandRecord,
  to: CommandStatus,
  phaseId: string,
  actorId: string,
  reasonCode: string,
  previousHash: string,
  timestamp: string,
): CommandStatusTransitionRecord {
  if (!canTransition(rec.status, to)) {
    throw new CommandError({
      code: "INVALID_COMMAND_STATUS_TRANSITION",
      message: `INVALID_COMMAND_STATUS_TRANSITION: ${rec.status} -> ${to}`,
    });
  }
  if (TERMINAL_STATUSES.has(rec.status)) {
    throw new CommandError({
      code: "INVALID_COMMAND_STATUS_TRANSITION",
      message: `INVALID_COMMAND_STATUS_TRANSITION: terminal ${rec.status} cannot transition`,
    });
  }
  const tr: CommandStatusTransitionRecord = {
    commandId: rec.commandId,
    fromStatus: rec.status,
    toStatus: to,
    phaseId,
    actorId,
    reasonCode,
    previousHash,
    recordHash: "",
    timestamp,
  };
  return { ...tr, recordHash: sha256Hex(canonicalSerialize(tr)) };
}

export class CommandLifecycle {
  private currentVersion = "0.1.0" as const;
  private audit = new AuditChain();

  validate(
    envelope: CommandEnvelope<CommandBody>,
    snapshot: CampaignSnapshot,
  ): LifecycleStepResult {
    if (envelope.version !== this.currentVersion) {
      return rejectValidation(
        envelope,
        snapshot,
        "VERSION_MISMATCH",
        `Expected version ${this.currentVersion}, got ${envelope.version}`,
      );
    }
    const computedHash = sha256Hex(canonicalSerialize(snapshot));
    if (envelope.expectedSnapshotHash !== computedHash) {
      return rejectValidation(
        envelope,
        snapshot,
        "STALE_SNAPSHOT_HASH",
        "Expected snapshot hash does not match current snapshot",
      );
    }
    return validatePayloadRules(envelope, snapshot);
  }

  authorize(envelope: CommandEnvelope<CommandBody>, slot: CampaignSlot): LifecycleStepResult {
    if (envelope.body.nationId !== slot.nationId) {
      return {
        ok: false,
        outcome: {
          type: "rejected",
          commandId: envelope.commandId,
          snapshotHash: envelope.expectedSnapshotHash,
          diagnostic: {
            code: "UNAUTHORIZED" as DiagnosticCode,
            severity: "error",
            stage: "authorize",
            message: `Nation ${envelope.body.nationId} is not authorized for slot ${slot.nationId}`,
          },
        },
      };
    }
    return { ok: true };
  }

  reserve(envelope: CommandEnvelope<CommandBody>, snapshot: CampaignSnapshot): LifecycleStepResult {
    const body = envelope.body;
    const nation = snapshot.nations.get(body.nationId);
    if (!nation)
      return {
        ok: false,
        outcome: {
          type: "rejected",
          commandId: envelope.commandId,
          snapshotHash: envelope.expectedSnapshotHash,
          diagnostic: {
            code: "NATION_NOT_FOUND" as DiagnosticCode,
            severity: "error",
            stage: "reserve",
            message: `Nation ${body.nationId} not found`,
          },
        },
      };
    if (body.type === "budget_project" && nation.treasury < body.budget) {
      return {
        ok: false,
        outcome: {
          type: "rejected",
          commandId: envelope.commandId,
          snapshotHash: envelope.expectedSnapshotHash,
          diagnostic: {
            code: "INSUFFICIENT_TREASURY" as DiagnosticCode,
            severity: "error",
            stage: "reserve",
            message: `Insufficient treasury: ${String(nation.treasury)} < ${String(body.budget)}`,
          },
        },
      };
    }
    return { ok: true };
  }

  accept(_envelope: CommandEnvelope<CommandBody>): void {}
  reject(envelope: CommandEnvelope<CommandBody>, reason: string): CommandOutcome {
    return {
      type: "rejected",
      commandId: envelope.commandId,
      snapshotHash: envelope.expectedSnapshotHash,
      diagnostic: {
        code: "REJECTED" as DiagnosticCode,
        severity: "error",
        stage: "lifecycle",
        message: reason,
      },
    };
  }
  lock(_envelope: CommandEnvelope<CommandBody>): void {}
  resolve(envelope: CommandEnvelope<CommandBody>, snapshot: CampaignSnapshot): CommandOutcome {
    const body = envelope.body;
    const snapshotHash = sha256Hex(canonicalSerialize(snapshot));
    if (body.type === "SetResearchPriority")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, fieldPriorities: body.fieldPriorities },
      };
    if (body.type === "AssignOfficer")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, officerId: body.officerId, divisionId: body.divisionId },
      };
    if (body.type === "RelieveOfficer")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, divisionId: body.divisionId },
      };
    if (body.type === "SubmitDesign")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, designVersionId: body.designVersionId },
      };
    if (body.type === "ReviseProject")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: {
          nationId: body.nationId,
          projectId: body.projectId,
          newDesignVersionId: body.newDesignVersionId,
        },
      };
    if (body.type === "StartRebuild")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: {
          nationId: body.nationId,
          shipId: body.shipId,
          projectId: body.projectId,
          newDesignVersionId: body.newDesignVersionId,
        },
      };
    if (body.type === "MoveFleet")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, fleetId: body.fleetId, toAreaId: body.toAreaId },
      };
    if (body.type === "HaltConstruction" || body.type === "ResumeConstruction")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, projectId: body.projectId },
      };
    if (body.type === "CancelConstructionProject")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, projectId: body.projectId },
      };
    if (body.type === "SetBudgetAllocation")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: {
          nationId: body.nationId,
          appropriationRateBp: body.appropriationRateBp,
          researchBudget: body.researchBudget,
        },
      };
    if (body.type === "DeclareWar")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, targetNationId: body.targetNationId },
      };
    if (body.type === "AcceptPeace")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, warId: body.warId },
      };
    if (body.type === "FormAlliance" || body.type === "BreakAlliance")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, partnerNationId: body.partnerNationId },
      };
    if (body.type === "FormNonAggressionPact" || body.type === "BreakNonAggressionPact")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, partnerNationId: body.partnerNationId },
      };
    if (body.type === "DeclareBlockade")
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: {
          nationId: body.nationId,
          targetNationId: body.targetNationId,
          areaId: body.areaId,
        },
      };
    if (
      body.type === "CreateDivision" ||
      body.type === "AddShipToDivision" ||
      body.type === "RemoveShipFromDivision" ||
      body.type === "DissolveDivision" ||
      body.type === "ChangeDivisionFlagship" ||
      body.type === "ReorderDivisionShips"
    )
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, divisionId: body.divisionId },
      };
    if (
      body.type === "AssignForeignStation" ||
      body.type === "ClearForeignStation" ||
      body.type === "SetShipReadiness"
    )
      return {
        type: "success",
        commandId: envelope.commandId,
        snapshotHash,
        result: { nationId: body.nationId, shipIds: [...body.shipIds] },
      };
    const b = body as BudgetProjectCommand;
    return {
      type: "success",
      commandId: envelope.commandId,
      snapshotHash,
      result: { budget: b.budget, nationId: b.nationId, projectId: b.projectId },
    };
  }

  process(
    envelope: CommandEnvelope<CommandBody>,
    snapshot: CampaignSnapshot,
    slot: CampaignSlot,
    idempotencyMap: CommandIdempotencyMap,
  ): CommandOutcome {
    const existing = idempotencyMap.get(envelope.idempotencyKey);
    if (existing) {
      if (existing.commandId === envelope.commandId)
        return {
          type: "idempotency_match",
          commandId: envelope.commandId,
          snapshotHash: envelope.expectedSnapshotHash,
          result:
            existing.type === "success" || existing.type === "idempotency_match"
              ? existing.result
              : undefined,
        };
      return {
        type: "idempotency_conflict",
        commandId: envelope.commandId,
        snapshotHash: envelope.expectedSnapshotHash,
        diagnostic: {
          code: "IDEMPOTENCY_CONFLICT" as DiagnosticCode,
          severity: "error",
          stage: "lifecycle",
          message: `Idempotency key ${envelope.idempotencyKey} already used by command ${existing.commandId}`,
        },
      };
    }
    const validation = this.validate(envelope, snapshot);
    if (!validation.ok) {
      idempotencyMap.set(envelope.idempotencyKey, validation.outcome);
      return validation.outcome;
    }
    const auth = this.authorize(envelope, slot);
    if (!auth.ok) {
      idempotencyMap.set(envelope.idempotencyKey, auth.outcome);
      return auth.outcome;
    }
    const reserveResult = this.reserve(envelope, snapshot);
    if (!reserveResult.ok) {
      idempotencyMap.set(envelope.idempotencyKey, reserveResult.outcome);
      return reserveResult.outcome;
    }
    this.accept(envelope);
    this.lock(envelope);
    const outcome = this.resolve(envelope, snapshot);
    idempotencyMap.set(envelope.idempotencyKey, outcome);
    this.audit.append(
      snapshot.campaignId,
      envelope.commandId,
      "process",
      slot.nationId,
      envelope.expectedSnapshotHash,
      sha256Hex(canonicalSerialize(outcome)),
      "0.1.0",
      "0.1.0",
      [outcome.type],
    );
    return outcome;
  }
}

export class CommandIdempotencyMap {
  private map = new Map<string, CommandOutcome>();
  has(key: string): boolean {
    return this.map.has(key);
  }
  get(key: string): CommandOutcome | undefined {
    return this.map.get(key);
  }
  set(key: string, outcome: CommandOutcome): void {
    this.map.set(key, outcome);
  }
}

export class CommandLedger {
  private records: CommandOutcome[] = [];
  add(outcome: CommandOutcome): void {
    this.records.push(outcome);
  }
  get all(): readonly CommandOutcome[] {
    return this.records;
  }
  hash(): string {
    return sha256Hex(canonicalSerialize(this.records));
  }
}

export class ScopedIdempotencyStore {
  private store = new Map<string, CommandRecord>();
  private keyFor(def: CommandTypeDefinition, idempotencyKey: string): string {
    return `${def.idempotencyScope}:${def.commandTypeId}:${idempotencyKey}`;
  }
  get(def: CommandTypeDefinition, idempotencyKey: string): CommandRecord | undefined {
    return this.store.get(this.keyFor(def, idempotencyKey));
  }
  set(def: CommandTypeDefinition, rec: CommandRecord): void {
    const k = this.keyFor(def, rec.idempotencyKey);
    if (this.store.has(k)) {
      const existing = this.store.get(k)!;
      if (existing.commandId !== rec.commandId) {
        throw new CommandError({
          code: "IDEMPOTENCY_CONFLICT",
          message: `Idempotency key ${rec.idempotencyKey} already used by ${existing.commandId}`,
        });
      }
      return;
    }
    this.store.set(k, rec);
  }
  checkDuplicate(
    def: CommandTypeDefinition,
    idempotencyKey: string,
    commandId: string,
  ): CommandRecord | undefined {
    const existing = this.get(def, idempotencyKey);
    if (existing && existing.commandId !== commandId) return existing;
    if (existing && existing.commandId === commandId) return existing;
    return undefined;
  }
}
