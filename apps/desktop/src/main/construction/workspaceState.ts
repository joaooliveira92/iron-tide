import {
  CommandLedger,
  ScopedIdempotencyStore,
  type CommandOutcome,
  type CommandRecord,
} from "@bluewave/commands";
import type { ConstructionCommand, ConstructionCommandStatus } from "@bluewave/campaign-engine";
import { CONSTRUCTION_COMMAND_DEFINITION } from "./commandDefinition.js";
import { forecastCapacityUnitsOf, forecastCostOf } from "./commandRecord.js";
import {
  ConstructionReservations,
  type ProjectedCosts,
  type ReservationFailure,
  type ReserveOrderResult,
} from "./reservationLedger.js";

export type {
  ProjectedCosts,
  ReservationFailure,
  ReserveOrderResult,
} from "./reservationLedger.js";

/**
 * The session-scoped construction workspace: the append-only command
 * bookkeeping that reflects the session's authoritative `CampaignState` to the
 * Construction screen.
 *
 * It is a class, not a bag of fields, so the invariants the command flows rely
 * on are enforced in one place instead of being re-derived by every caller:
 * the machinery's idempotency/ledger objects stay private, a record and its UI
 * row are written together, and the F2 rollback (`restoreInFlight`) is a
 * single operation. The command flows still own the *ordering* (validate →
 * reserve → persist → bookkeep); the workspace owns the *state transitions*.
 *
 * Reservations are delegated to `ConstructionReservations`, which is the only
 * module that knows the pool internals — this class hands it the costs and
 * never touches pool state itself.
 */
export class ConstructionWorkspace {
  readonly sessionId: string;
  readonly playerSlotId: string;

  private readonly idempotency = new ScopedIdempotencyStore();
  private readonly reservations: ConstructionReservations;
  private readonly ledger = new CommandLedger();
  private readonly records = new Map<string, CommandRecord>();
  private uiCommands: ConstructionCommand[] = [];
  private ordinal = 1;

  constructor(sessionId: string, playerSlotId: string, treasury: number, capacity: number) {
    this.sessionId = sessionId;
    this.playerSlotId = playerSlotId;
    this.reservations = new ConstructionReservations(playerSlotId, treasury, capacity);
  }

  nextSubmissionOrdinal(): number {
    return this.ordinal++;
  }

  getRecord(commandId: string): CommandRecord | undefined {
    return this.records.get(commandId);
  }

  putRecord(record: CommandRecord): void {
    this.records.set(record.commandId, record);
  }

  /** The UI-facing command list in submission order. */
  commandRows(): readonly ConstructionCommand[] {
    return this.uiCommands;
  }

  appendCommand(command: ConstructionCommand): void {
    this.uiCommands.push(command);
  }

  /** Write a row's status in place, preserving submission order. */
  setCommandStatus(commandId: string, status: ConstructionCommandStatus): void {
    this.uiCommands = this.uiCommands.map((command) =>
      command.commandId === commandId ? { ...command, status } : command,
    );
  }

  rememberIdempotent(record: CommandRecord): void {
    this.idempotency.set(CONSTRUCTION_COMMAND_DEFINITION, record);
  }

  findIdempotent(transportRequestId: string): CommandRecord | undefined {
    return this.idempotency.get(CONSTRUCTION_COMMAND_DEFINITION, transportRequestId);
  }

  appendLedger(outcome: CommandOutcome): void {
    this.ledger.add(outcome);
  }

  /** Hold the projected treasury + capacity for a freshly accepted order. */
  reserve(record: CommandRecord, costs: ProjectedCosts): ReserveOrderResult {
    return this.reservations.reserve(record, costs);
  }

  release(commandId: string): void {
    this.reservations.release(commandId);
  }

  /**
   * F2 rollback: put a command that was settled/released back to a pristine
   * in-flight ACCEPTED state — the record is restored and its reservation
   * re-held (the reservation ids are derived deterministically from the
   * commandId, so they match the re-reserve). Used when a cancel/replace's
   * persist fails, so the workspace can never report a terminal outcome the
   * package doesn't reflect.
   */
  restoreInFlight(original: CommandRecord): void {
    this.records.set(original.commandId, original);
    this.release(original.commandId);
    this.reserve(original, {
      projectedCost: forecastCostOf(original),
      projectedCapacityUnits: forecastCapacityUnitsOf(original),
    });
    this.setCommandStatus(original.commandId, "submitted");
  }

  /**
   * F2 preflight: would the replacement's reservation fit once the original's
   * supersession releases its hold? Delegated to the reservation ledger; see
   * `ConstructionReservations.canReserveReplacement`.
   */
  canReserveReplacement(
    originalCommandId: string,
    costs: ProjectedCosts,
  ): { readonly ok: true } | ReservationFailure {
    return this.reservations.canReserveReplacement(originalCommandId, costs);
  }

  /**
   * Re-point both pools at the session's current real numbers before a command
   * (`nation.treasury`, shipyard capacity), so reservations can never outrun
   * the current snapshot even after `commitMonth` moved them.
   */
  syncPools(treasury: number, capacity: number): void {
    this.reservations.sync(treasury, capacity);
  }
}
