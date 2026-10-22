import { createEnvelope } from "@bluewave/deterministic";

export const AIRCRAFT_RECORD_POLICY_ID = "aircraft_record_v1" as const;

export interface AircraftRecord {
  recordId: string;
  nationId: string;
  kind: string;
  entityId: string;
  operation: string;
  inputHash: string;
  outputHash: string;
  campaignMonth: string;
  reasonCode: string;
  rulesetVersion: string;
  recordHash: string;
}

type AircraftRecordBody = Omit<AircraftRecord, "recordHash">;

export function computeAircraftRecordHash(body: AircraftRecordBody): string {
  const envelope = createEnvelope("aircraft-record", AIRCRAFT_RECORD_POLICY_ID, body);
  return envelope.bodyHash;
}

export function createAircraftRecord(params: AircraftRecordBody): AircraftRecord {
  const body: AircraftRecordBody = { ...params };
  return { ...body, recordHash: computeAircraftRecordHash(body) };
}

export function verifyAircraftRecordHash(record: AircraftRecord): boolean {
  const { recordHash, ...body } = record;
  return computeAircraftRecordHash(body) === recordHash;
}
