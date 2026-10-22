import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { CommandRecord, CommandReservationRecord } from "./types.js";

export interface ResourcePool {
  resourceTypeId: string;
  resourceId: string;
  available: number;
  reserved: Map<string, number>;
}

export class ReservationManager {
  private pools = new Map<string, ResourcePool>();

  registerPool(pool: ResourcePool): void {
    this.pools.set(`${pool.resourceTypeId}:${pool.resourceId}`, pool);
  }

  reserve(
    command: CommandRecord,
    requirements: Array<{
      resourceTypeId: string;
      resourceId: string;
      quantity: number;
      canonicalUnit: string;
      priority: number;
    }>,
    phaseId: string,
  ):
    | { ok: true; records: CommandReservationRecord[] }
    | { ok: false; reasonCode: string; failedResource: string } {
    const sorted = [...requirements].sort((a, b) =>
      compareCodePoints(
        `${a.resourceTypeId}:${a.resourceId}`,
        `${b.resourceTypeId}:${b.resourceId}`,
      ),
    );
    for (const req of sorted) {
      const key = `${req.resourceTypeId}:${req.resourceId}`;
      const pool = this.pools.get(key);
      if (!pool) return { ok: false, reasonCode: "RESERVATION_FAILED", failedResource: key };
      const totalReserved = [...pool.reserved.values()].reduce((a, b) => a + b, 0);
      if (pool.available - totalReserved < req.quantity) {
        const domainReason =
          req.resourceTypeId === "TREASURY"
            ? "INSUFFICIENT_FUNDS"
            : req.resourceTypeId === "CAPACITY"
              ? "INSUFFICIENT_CAPACITY"
              : "INSUFFICIENT_INVENTORY";
        return { ok: false, reasonCode: domainReason, failedResource: key };
      }
    }
    const records: CommandReservationRecord[] = [];
    for (const req of sorted) {
      const key = `${req.resourceTypeId}:${req.resourceId}`;
      const pool = this.pools.get(key)!;
      pool.reserved.set(
        command.commandId,
        (pool.reserved.get(command.commandId) ?? 0) + req.quantity,
      );
      const rec: CommandReservationRecord = {
        reservationId: `${command.commandId}:${req.resourceTypeId}:${req.resourceId}`,
        commandId: command.commandId,
        resourceTypeId: req.resourceTypeId,
        resourceId: req.resourceId,
        reservedQuantity: req.quantity,
        canonicalUnit: req.canonicalUnit,
        reservationStartPhase: phaseId,
        reservationReleaseCondition: "ON_SETTLEMENT",
        reservationConsumptionPolicy: "CONSUME_ON_COMMIT",
        reservationPriority: req.priority,
        reservationHash: "",
      };
      const hashed = { ...rec, reservationHash: sha256Hex(canonicalSerialize(rec)) };
      records.push(hashed);
    }
    return { ok: true, records };
  }

  release(commandId: string): void {
    for (const pool of this.pools.values()) pool.reserved.delete(commandId);
  }

  getReserved(commandId: string): number {
    let total = 0;
    for (const pool of this.pools.values()) total += pool.reserved.get(commandId) ?? 0;
    return total;
  }
}
