import { ReservationManager, type CommandRecord, type ResourcePool } from "@bluewave/commands";
import { reservationRequirementsFor } from "./reservationRequirements.js";

export interface ProjectedCosts {
  readonly projectedCost: number;
  readonly projectedCapacityUnits: number;
}

export type ReservationFailure = {
  readonly ok: false;
  readonly reasonCode: string;
  readonly diagnostics: string[];
};

export type ReserveOrderResult =
  | { readonly ok: true; readonly recordIds: string[] }
  | ReservationFailure;

const CONSTRUCTION_RESERVATION_PHASE = "construction_submission";

export class ConstructionReservations {
  private readonly manager = new ReservationManager();
  private readonly treasuryPool: ResourcePool;
  private readonly capacityPool: ResourcePool;

  constructor(
    private readonly playerSlotId: string,
    treasury: number,
    capacity: number,
  ) {
    this.treasuryPool = makePool("TREASURY", playerSlotId, treasury);
    this.capacityPool = makePool("CAPACITY", playerSlotId, capacity);
    this.manager.registerPool(this.treasuryPool);
    this.manager.registerPool(this.capacityPool);
  }

  reserve(record: CommandRecord, costs: ProjectedCosts): ReserveOrderResult {
    const result = this.manager.reserve(
      record,
      reservationRequirementsFor(this.playerSlotId, costs),
      CONSTRUCTION_RESERVATION_PHASE,
    );
    if (result.ok) return { ok: true, recordIds: result.records.map((r) => r.reservationId) };
    const reasonCode =
      result.reasonCode === "INSUFFICIENT_FUNDS" || result.reasonCode === "INSUFFICIENT_CAPACITY"
        ? result.reasonCode
        : "RESERVATION_FAILED";
    return {
      ok: false,
      reasonCode,
      diagnostics: [
        `${result.reasonCode}: could not reserve ${result.failedResource} for construction order ${record.commandId}`,
      ],
    };
  }

  release(commandId: string): void {
    this.manager.release(commandId);
  }

  canReserveReplacement(
    originalCommandId: string,
    costs: ProjectedCosts,
  ): { readonly ok: true } | ReservationFailure {
    const checks = [
      {
        pool: this.treasuryPool,
        quantity: costs.projectedCost,
        failCode: "INSUFFICIENT_FUNDS",
        label: "treasury",
      },
      {
        pool: this.capacityPool,
        quantity: costs.projectedCapacityUnits,
        failCode: "INSUFFICIENT_CAPACITY",
        label: "shipyard capacity",
      },
    ] as const;
    for (const check of checks) {
      const totalReserved = [...check.pool.reserved.values()].reduce((sum, r) => sum + r, 0);
      const originalHeld = check.pool.reserved.get(originalCommandId) ?? 0;
      const availableForReplacement = check.pool.available - (totalReserved - originalHeld);
      if (availableForReplacement < check.quantity) {
        return {
          ok: false,
          reasonCode: check.failCode,
          diagnostics: [
            `${check.failCode}: replacement needs ${check.quantity} ${check.label}; only ${Math.max(0, availableForReplacement)} would be available after releasing ${originalCommandId}'s hold`,
          ],
        };
      }
    }
    return { ok: true };
  }

  sync(treasury: number, capacity: number): void {
    this.treasuryPool.available = treasury;
    this.capacityPool.available = capacity;
  }
}

function makePool(
  resourceTypeId: "TREASURY" | "CAPACITY",
  resourceId: string,
  available: number,
): ResourcePool {
  return { resourceTypeId, resourceId, available, reserved: new Map() };
}
