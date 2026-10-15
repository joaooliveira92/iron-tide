// D-4 M4 Aviation: Air Defense — AC-15 canonical ordering per DESIGN-45 §27.
// Parallel to air-combat/ordering.ts pattern.
//
// §27: air defense MUST resolve by, in order:
//   1. incoming attack arrival time (minute, then substep);
//   2. defense-layer order from §1 (the full 8-layer order — CAP … CIWS_TERMINAL_DEFENSE);
//   3. defended ship identifier;
//   4. threat priority from §17 (the resolved §11.2/§17 comparator applied to records:
//      released first → closer to impact first → defended ship first (targetId === this
//      record's defenderId) → expected-damage proxy (threatFormationSize) descending →
//      target identifier ascending);
//   5. defense-system identifier;
//   6. director and radar-channel identifier (director, then radar);
//   7. engagement identifier (recordId);
//   8. outcome effect ordinal (§27.8 — AIR_DEFENSE_OUTCOME_ORDINALS).
//
// Database insertion order, UI order, localized names, rendering order, and wall-clock time
// MUST NOT affect results (§27 line 453): every key is a codepoint comparison (never
// localeCompare) and the comparator is pure — no randomness, clock, env, or locale.

import type { AirDefenseEngagementRecord } from "./records.js";
import { FULL_DEFENSE_LAYER_ORDER } from "./constants.js";

/** Codepoint string comparison — the determinism contract (NEVER localeCompare). */
export function compareStrings(a: string, b: string): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return a.charCodeAt(i) - b.charCodeAt(i);
  }
  return a.length - b.length;
}

/** §27.2 rank of a record's layer in the full §1 order; unknown layers sort LAST. */
function layerRank(layer: AirDefenseEngagementRecord["layer"]): number {
  const index = FULL_DEFENSE_LAYER_ORDER.indexOf(layer);
  return index === -1 ? FULL_DEFENSE_LAYER_ORDER.length : index;
}

/** §27.4 the §17 threat-priority chain applied to two records of the same defender. */
function compareRecordThreatPriority(
  a: AirDefenseEngagementRecord,
  b: AirDefenseEngagementRecord,
): number {
  // §17.1: weapons already released before aircraft pre-release.
  if (a.threatReleased !== b.threatReleased) return a.threatReleased ? -1 : 1;
  // §17 "closest to impact" / §17.6: smaller timeToImpactMs first.
  if (a.timeToImpactMs !== b.timeToImpactMs) return a.timeToImpactMs < b.timeToImpactMs ? -1 : 1;
  // §17.3-4: threats against the defended ship (this record's defenderId) first.
  const aDefendsDefender = a.targetId === a.defenderId;
  const bDefendsDefender = b.targetId === b.defenderId;
  if (aDefendsDefender !== bDefendsDefender) return aDefendsDefender ? -1 : 1;
  // §17.5: expected-damage proxy DESCENDING — larger threatFormationSize first.
  if (a.threatFormationSize !== b.threatFormationSize) {
    return a.threatFormationSize > b.threatFormationSize ? -1 : 1;
  }
  // §17.7: target identifier ASCENDING.
  return compareStrings(a.targetId, b.targetId);
}

/** AC-15 (§27): the canonical total order over air-defense engagement records. */
export function compareAirDefenseEngagementRecords(
  a: AirDefenseEngagementRecord,
  b: AirDefenseEngagementRecord,
): number {
  // 1. §27.1 incoming attack arrival time.
  const byMinute = Number(a.minute) - Number(b.minute);
  if (byMinute !== 0) return byMinute;
  const bySubstep = Number(a.substep) - Number(b.substep);
  if (bySubstep !== 0) return bySubstep;
  // 2. §27.2 defense-layer order from §1.
  const byLayer = layerRank(a.layer) - layerRank(b.layer);
  if (byLayer !== 0) return byLayer;
  // 3. §27.3 defended ship identifier.
  const byDefender = compareStrings(a.defenderId, b.defenderId);
  if (byDefender !== 0) return byDefender;
  // 4. §27.4 threat priority from §17.
  const byThreat = compareRecordThreatPriority(a, b);
  if (byThreat !== 0) return byThreat;
  // 5. §27.5 defense-system identifier.
  const bySystem = compareStrings(a.defenseSystemId, b.defenseSystemId);
  if (bySystem !== 0) return bySystem;
  // 6. §27.6 director and radar-channel identifier.
  const byDirector = compareStrings(a.directorChannelId ?? "", b.directorChannelId ?? "");
  if (byDirector !== 0) return byDirector;
  const byRadar = compareStrings(a.radarChannelId ?? "", b.radarChannelId ?? "");
  if (byRadar !== 0) return byRadar;
  // 7. §27.7 engagement identifier.
  const byRecord = compareStrings(a.recordId, b.recordId);
  if (byRecord !== 0) return byRecord;
  // 8. §27.8 outcome effect ordinal.
  return Number(a.outcomeOrdinal) - Number(b.outcomeOrdinal);
}

/** §27 canonical sort — returns a NEW sorted array; the input is never mutated. */
export function canonicallySortedAirDefenseRecords(
  records: readonly AirDefenseEngagementRecord[],
): AirDefenseEngagementRecord[] {
  return [...records].sort(compareAirDefenseEngagementRecords);
}
