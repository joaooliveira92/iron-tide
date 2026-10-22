import { type DamageEventRecord } from "./eventRecord.js";

export function damageEventOrder(a: DamageEventRecord, b: DamageEventRecord): number {
  return (
    a.battleMinute - b.battleMinute ||
    a.substep - b.substep ||
    a.sourceId.localeCompare(b.sourceId) ||
    a.targetShipId.localeCompare(b.targetShipId) ||
    a.causalWeaponId.localeCompare(b.causalWeaponId) ||
    a.hitLocation.localeCompare(b.hitLocation) ||
    a.recordHash.localeCompare(b.recordHash)
  );
}
