import { type DamageEventRecord } from "./eventRecord.js";
import { compareStrings } from "../core/ordering.js";

export function damageEventOrder(a: DamageEventRecord, b: DamageEventRecord): number {
  return (
    a.battleMinute - b.battleMinute ||
    a.substep - b.substep ||
    compareStrings(a.sourceId, b.sourceId) ||
    compareStrings(a.targetShipId, b.targetShipId) ||
    compareStrings(a.causalWeaponId, b.causalWeaponId) ||
    compareStrings(a.hitLocation, b.hitLocation) ||
    compareStrings(a.recordHash, b.recordHash)
  );
}
