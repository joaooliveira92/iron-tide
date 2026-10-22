import type { AirCombatRecord } from "./records.js";

export function compareStrings(a: string, b: string): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return a.charCodeAt(i) - b.charCodeAt(i);
  }
  return a.length - b.length;
}

export function compareAirCombatRecords(a: AirCombatRecord, b: AirCombatRecord): number {
  const byMinute = Number(a.minute) - Number(b.minute);
  if (byMinute !== 0) return byMinute;
  const bySubstep = Number(a.substep) - Number(b.substep);
  if (bySubstep !== 0) return bySubstep;
  const byActor = compareStrings(a.actorId, b.actorId);
  if (byActor !== 0) return byActor;
  const byTarget = compareStrings(a.targetId ?? "", b.targetId ?? "");
  if (byTarget !== 0) return byTarget;
  return compareStrings(a.recordKind, b.recordKind);
}

export function canonicallySortedRecords(records: readonly AirCombatRecord[]): AirCombatRecord[] {
  return [...records].sort(compareAirCombatRecords);
}
