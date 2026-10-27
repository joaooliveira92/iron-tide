import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";

import {
  MISSILE_FORMULA_VERSION,
  MISSILE_RULESET_VERSION,
  MISSILE_RECORD_KINDS,
  missilePolicyId,
  type MissileRecordKind,
  type SsmMissileClass,
} from "./constants.js";
import { MISSILE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export interface MissileRecord {
  readonly recordId: string;
  readonly kind: MissileRecordKind;
  readonly battleMinute: number;
  readonly substep: number;
  readonly salvoId: string;
  readonly launcherId: string;
  readonly ownerShipId: string;
  readonly sideId: string;
  readonly missileClass: SsmMissileClass;
  readonly targetShipId: string;
  readonly missiles: number;
  readonly streamId: string | null;
  readonly draw: number | null;
  readonly drawBp: number | null;
  readonly outcome: string;
  readonly reasonCode: string;
  readonly formulaVersion: string;
  readonly rulesetVersion: string;
  readonly recordHash: string;
}

export type MissileRecordBody = Omit<MissileRecord, "recordHash">;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isSafeInteger(value);
}

function invariant(recordId: string, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(MISSILE_STATE_INVARIANT_FAILED, {
    code: MISSILE_STATE_INVARIANT_FAILED,
    recordId,
    field,
    reason,
    value,
  });
}

export function missileRecordId(input: {
  battleId: string;
  minute: number;
  substep: number;
  kind: MissileRecordKind;
  salvoId: string;
  missileOrdinal: number;
}): string {
  return `${input.battleId}:${input.minute}:${input.substep}:missile_${input.kind.toLowerCase()}:${input.salvoId}:${input.missileOrdinal}`;
}

export function assertMissileRecordSurface(record: MissileRecord): void {
  const id = isNonEmptyString(record.recordId) ? record.recordId : "?";
  if (!isNonEmptyString(record.recordId))
    invariant(id, "recordId", record.recordId, "record id must be a non-empty string");
  if (!(MISSILE_RECORD_KINDS as readonly string[]).includes(record.kind))
    invariant(id, "kind", record.kind, "kind must be a canonical missile record kind");
  if (!isSafeInt(record.battleMinute) || record.battleMinute < 0)
    invariant(id, "battleMinute", record.battleMinute, "battle minute must be non-negative");
  if (!isSafeInt(record.substep) || record.substep < 1)
    invariant(id, "substep", record.substep, "substep must be positive");
  for (const field of ["salvoId", "launcherId", "ownerShipId", "sideId", "targetShipId"] as const) {
    if (!isNonEmptyString(record[field]))
      invariant(id, field, record[field], `${field} must be a non-empty string`);
  }
  if (
    !(
      record.missileClass === "light_ssm" ||
      record.missileClass === "medium_ssm" ||
      record.missileClass === "heavy_ssm"
    )
  )
    invariant(id, "missileClass", record.missileClass, "missile class must be an SSM class");
  if (!isSafeInt(record.missiles) || record.missiles < 1)
    invariant(id, "missiles", record.missiles, "missiles must be a positive integer");
  if (record.streamId !== null && !isNonEmptyString(record.streamId))
    invariant(id, "streamId", record.streamId, "stream id must be a string or null");
  if (
    record.draw !== null &&
    (typeof record.draw !== "number" || record.draw < 0 || record.draw >= 1)
  )
    invariant(id, "draw", record.draw, "draw must be a float within [0, 1) or null");
  if (
    record.drawBp !== null &&
    (!isSafeInt(record.drawBp) || record.drawBp < 0 || record.drawBp >= 10_000)
  )
    invariant(id, "drawBp", record.drawBp, "drawBp must be an integer within [0, 10_000) or null");
  if (!isNonEmptyString(record.outcome))
    invariant(id, "outcome", record.outcome, "outcome must be a non-empty string");
  if (!isNonEmptyString(record.reasonCode))
    invariant(id, "reasonCode", record.reasonCode, "reason code must be a non-empty string");
  if (
    record.rulesetVersion !== MISSILE_RULESET_VERSION ||
    record.formulaVersion !== MISSILE_FORMULA_VERSION
  )
    invariant(id, "versions", record, "record must carry the shipped missile versions");
}

export function computeMissileRecordHash(body: MissileRecordBody): string {
  return createEnvelope("missile-record", missilePolicyId, body).bodyHash;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== null && typeof nested === "object") deepFreeze(nested);
    }
  }
  return value;
}

export function makeMissileRecord(body: MissileRecordBody): MissileRecord {
  assertMissileRecordSurface({ ...body, recordHash: "" } as MissileRecord);
  return deepFreeze({ ...body, recordHash: computeMissileRecordHash(body) });
}

export function verifyMissileRecordHash(record: MissileRecord): boolean {
  const { recordHash: _ignored, ...body } = record;
  return computeMissileRecordHash(body) === record.recordHash;
}
