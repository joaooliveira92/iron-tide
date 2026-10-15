//packages/combat/src/damage/ordering.ts
// DESIGN-41 §46 — Canonical ordering for damage events.
// Orders by (battleMinute, substep, sourceId, targetShipId, causalWeaponId,
// hitLocation, recordHash). This mirrors the gunneryEventOrder pattern but
// for damage events. Pure/deterministic comparator.

import { type DamageEventRecord } from "./eventRecord.js";

/**
 * Canonical ordering comparator for DamageEventRecord.
 *
 * Per DESIGN-41 §46, the ordering is:
 *   1. battleMinute (ascending)
 *   2. substep (ascending)
 *   3. sourceId (lexicographic)
 *   4. targetShipId (lexicographic)
 *   5. causalWeaponId (lexicographic)
 *   6. hitLocation (lexicographic)
 *   7. recordHash (lexicographic, tiebreaker)
 *
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
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
