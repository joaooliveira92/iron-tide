import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { submarineStrategicAssetPolicyId } from "./constants.js";

export interface SubmarineOperationsRecord {
  month: SafeInt;
  warIds: readonly string[];
  areaIds: readonly string[];
  assetIds: readonly string[];
  missionIds: readonly string[];
  targetIds: readonly string[];
  battleIds: readonly string[];
  aswContactIds: readonly string[];
  friendlyFireCheckIds: readonly string[];
  rulesetVersion: string;
  formulaVersion: string;
  recordHash: string;
}

export function computeSubmarineOperationsRecordHash(
  r: Omit<SubmarineOperationsRecord, "recordHash">,
): string {
  const { recordHash: _ignored, ...surface } = r as SubmarineOperationsRecord;
  return createEnvelope("submarine-operations-record", submarineStrategicAssetPolicyId, surface)
    .bodyHash;
}

export function withSubmarineOperationsRecordHash(
  r: Omit<SubmarineOperationsRecord, "recordHash">,
): SubmarineOperationsRecord {
  return { ...r, recordHash: computeSubmarineOperationsRecordHash(r) };
}

export function orderWarsById(warIds: readonly string[]): readonly string[] {
  return [...warIds].sort((a, b) => a.localeCompare(b));
}

export function orderAreasById(areaIds: readonly string[]): readonly string[] {
  return [...areaIds].sort((a, b) => a.localeCompare(b));
}

export function orderSubmarineAssetsById(assetIds: readonly string[]): readonly string[] {
  return [...assetIds].sort((a, b) => a.localeCompare(b));
}

export function orderMissionsByPriority(
  missionIds: readonly string[],
  priorities: Record<string, number>,
): readonly string[] {
  return [...missionIds].sort((a, b) => {
    const pa = priorities[a] ?? 999;
    const pb = priorities[b] ?? 999;
    return pa - pb;
  });
}

export function orderTargetsById(targetIds: readonly string[]): readonly string[] {
  return [...targetIds].sort((a, b) => a.localeCompare(b));
}

export function orderBattleAllocationsById(battleIds: readonly string[]): readonly string[] {
  return [...battleIds].sort((a, b) => a.localeCompare(b));
}

export function orderAswContactsById(contactIds: readonly string[]): readonly string[] {
  return [...contactIds].sort((a, b) => a.localeCompare(b));
}

export function orderFriendlyFireChecksById(
  checks: readonly { contactId: string; submarineAssetId: string }[],
): readonly { contactId: string; submarineAssetId: string }[] {
  return [...checks].sort((a, b) => {
    const byContact = a.contactId.localeCompare(b.contactId);
    if (byContact !== 0) return byContact;
    return a.submarineAssetId.localeCompare(b.submarineAssetId);
  });
}
