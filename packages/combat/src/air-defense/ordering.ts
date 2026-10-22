import type { AirDefenseEngagementRecord } from "./records.js";
import { FULL_DEFENSE_LAYER_ORDER } from "./constants.js";

export function compareStrings(a: string, b: string): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return a.charCodeAt(i) - b.charCodeAt(i);
  }
  return a.length - b.length;
}

function layerRank(layer: AirDefenseEngagementRecord["layer"]): number {
  const index = FULL_DEFENSE_LAYER_ORDER.indexOf(layer);
  return index === -1 ? FULL_DEFENSE_LAYER_ORDER.length : index;
}

function compareRecordThreatPriority(
  a: AirDefenseEngagementRecord,
  b: AirDefenseEngagementRecord,
): number {
  if (a.threatReleased !== b.threatReleased) return a.threatReleased ? -1 : 1;
  if (a.timeToImpactMs !== b.timeToImpactMs) return a.timeToImpactMs < b.timeToImpactMs ? -1 : 1;
  const aDefendsDefender = a.targetId === a.defenderId;
  const bDefendsDefender = b.targetId === b.defenderId;
  if (aDefendsDefender !== bDefendsDefender) return aDefendsDefender ? -1 : 1;
  if (a.threatFormationSize !== b.threatFormationSize) {
    return a.threatFormationSize > b.threatFormationSize ? -1 : 1;
  }
  return compareStrings(a.targetId, b.targetId);
}

export function compareAirDefenseEngagementRecords(
  a: AirDefenseEngagementRecord,
  b: AirDefenseEngagementRecord,
): number {
  const byMinute = Number(a.minute) - Number(b.minute);
  if (byMinute !== 0) return byMinute;
  const bySubstep = Number(a.substep) - Number(b.substep);
  if (bySubstep !== 0) return bySubstep;
  const byLayer = layerRank(a.layer) - layerRank(b.layer);
  if (byLayer !== 0) return byLayer;
  const byDefender = compareStrings(a.defenderId, b.defenderId);
  if (byDefender !== 0) return byDefender;
  const byThreat = compareRecordThreatPriority(a, b);
  if (byThreat !== 0) return byThreat;
  const bySystem = compareStrings(a.defenseSystemId, b.defenseSystemId);
  if (bySystem !== 0) return bySystem;
  const byDirector = compareStrings(a.directorChannelId ?? "", b.directorChannelId ?? "");
  if (byDirector !== 0) return byDirector;
  const byRadar = compareStrings(a.radarChannelId ?? "", b.radarChannelId ?? "");
  if (byRadar !== 0) return byRadar;
  const byRecord = compareStrings(a.recordId, b.recordId);
  if (byRecord !== 0) return byRecord;
  return Number(a.outcomeOrdinal) - Number(b.outcomeOrdinal);
}

export function canonicallySortedAirDefenseRecords(
  records: readonly AirDefenseEngagementRecord[],
): AirDefenseEngagementRecord[] {
  return [...records].sort(compareAirDefenseEngagementRecords);
}
