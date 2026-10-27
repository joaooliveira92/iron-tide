import type { MissileRecord } from "./records.js";

export function compareMissileStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const KIND_ORDER: Record<MissileRecord["kind"], number> = {
  LAUNCH: 1,
  INTERCEPT: 2,
  HIT: 3,
  MISS: 4,
};

export function missileRecordOrder(a: MissileRecord, b: MissileRecord): number {
  return (
    a.battleMinute - b.battleMinute ||
    a.substep - b.substep ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    compareMissileStrings(a.launcherId, b.launcherId) ||
    compareMissileStrings(a.targetShipId, b.targetShipId) ||
    compareMissileStrings(a.recordId, b.recordId)
  );
}

export function sortMissileRecords(records: readonly MissileRecord[]): MissileRecord[] {
  return [...records].sort(missileRecordOrder);
}

export function missileSalvoOrder(a: { salvoId: string }, b: { salvoId: string }): number {
  return compareMissileStrings(a.salvoId, b.salvoId);
}
