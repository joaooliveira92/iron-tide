import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { CombatInvariantError } from "../errors.js";
import { AIR_COMBAT_RECORD_INTEGRITY_FAILURE } from "./reasonCodes.js";

export const AIR_COMBAT_RECORD_POLICY_ID = "air_combat_record_v1" as const;

export interface AirCombatRecord {
  recordId: string;
  battleId: string;
  minute: SafeInt;
  substep: SafeInt;
  recordKind: string;
  actorId: string;
  targetId: string | null;
  description: string;
  reasonCode: string;
  rulesetVersion: string;
  recordHash: string;
}

type AirCombatRecordBody = Omit<AirCombatRecord, "recordHash">;

export function computeAirCombatRecordHash(body: AirCombatRecordBody): string {
  const envelope = createEnvelope("air-combat-record", AIR_COMBAT_RECORD_POLICY_ID, body);
  return envelope.bodyHash;
}

export function createAirCombatRecord(params: AirCombatRecordBody): AirCombatRecord {
  const body: AirCombatRecordBody = { ...params };
  return { ...body, recordHash: computeAirCombatRecordHash(body) };
}

export function verifyAirCombatRecordHash(record: AirCombatRecord): boolean {
  const { recordHash, ...body } = record;
  return computeAirCombatRecordHash(body) === recordHash;
}

export function assertAirCombatRecordHash(record: AirCombatRecord): void {
  if (!verifyAirCombatRecordHash(record)) {
    throw new CombatInvariantError({
      message: AIR_COMBAT_RECORD_INTEGRITY_FAILURE,
      code: AIR_COMBAT_RECORD_INTEGRITY_FAILURE,
      context: { recordId: record.recordId },
    });
  }
}
