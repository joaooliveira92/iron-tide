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

  commandRows(): readonly ConstructionCommand[] {
    return this.uiCommands;
  }

  appendCommand(command: ConstructionCommand): void {
    this.uiCommands.push(command);
  }

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

  reserve(record: CommandRecord, costs: ProjectedCosts): ReserveOrderResult {
    return this.reservations.reserve(record, costs);
  }

  release(commandId: string): void {
    this.reservations.release(commandId);
  }

  restoreInFlight(original: CommandRecord): void {
    this.records.set(original.commandId, original);
    this.release(original.commandId);
    this.reserve(original, {
      projectedCost: forecastCostOf(original),
      projectedCapacityUnits: forecastCapacityUnitsOf(original),
    });
    this.setCommandStatus(original.commandId, "submitted");
  }

  canReserveReplacement(
    originalCommandId: string,
    costs: ProjectedCosts,
  ): { readonly ok: true } | ReservationFailure {
    return this.reservations.canReserveReplacement(originalCommandId, costs);
  }

  syncPools(treasury: number, capacity: number): void {
    this.reservations.sync(treasury, capacity);
  }
}
