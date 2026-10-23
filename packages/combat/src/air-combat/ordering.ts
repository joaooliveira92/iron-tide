import { compareStrings } from "../core/ordering.js";
import type { AirCombatRecord } from "./records.js";

export { compareStrings };

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
