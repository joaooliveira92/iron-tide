import { ReservationManager, type CommandRecord, type ResourcePool } from "@bluewave/commands";
import { reservationRequirementsFor } from "./reservationRequirements.js";

/**
 * The construction workspace's reservation ledger: the two TREASURY/CAPACITY
 * pools, the `ReservationManager` that holds against them, and the affordability
 * arithmetic (hold, release, replacement preflight, snapshot sync).
 *
 * It is deliberately the *only* place that knows the shape of a `ResourcePool`
 * (its `available`/`reserved` internals) and the reservation requirements an
 * order commits. The workspace composes it and delegates, so the command
 * bookkeeping never reaches into pool state — the two reasons to change
 * (reservation policy vs. command bookkeeping) stay in separate modules.
 */

/** The projected treasury + capacity one order commits. */
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

/** The phaseId recorded on every construction reservation. */
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

  /** Hold the projected treasury + capacity for a freshly accepted order. */
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

  /**
   * F2 preflight: would the replacement's reservation fit once the original's
   * supersession releases its hold? Mirrors `ReservationManager.reserve`'s own
   * affordability check (`pool.available - totalReserved >= quantity`), run
   * against the CURRENT pools with the original's released hold counted as
   * available — so a rejected replace never mutates or persists anything.
   */
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

  /**
   * Re-point both pools at the session's current real numbers before a command
   * (`nation.treasury`, shipyard capacity), so reservations can never outrun
   * the current snapshot even after `commitMonth` moved them. The pool objects
   * are held by reference by `ReservationManager`, so the in-place `available`
   * update preserves existing reservations.
   */
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
