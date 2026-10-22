import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION, torpedoPolicyId } from "./constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const TORPEDO_RECORD_KINDS = [
  "LAUNCH",
  "TRACK",
  "DETECTION",
  "HIT_RESOLUTION",
  "DETONATION",
  "DAMAGE",
  "FLOODING_SOURCE",
  "MACHINERY",
  "SYSTEM_SHOCK",
  "TUBE_HAZARD",
  "CHAIN_REACTION",
] as const;
export type TorpedoRecordKind = (typeof TORPEDO_RECORD_KINDS)[number];

export function isTorpedoRecordKind(v: string): v is TorpedoRecordKind {
  return (TORPEDO_RECORD_KINDS as readonly string[]).includes(v);
}

export interface TorpedoRecord {
  recordId: string;
  kind: TorpedoRecordKind;
  battleMinute: number;
  substep: number;
  sourceId: string;
  targetId: string;
  commandSource: string;
  legalContactId: string | null;
  torpedoModelId: string | null;
  launcherId: string | null;
  settingId: string | null;
  solutionInputs: readonly { key: string; value: number }[];
  solutionQualityBp: number | null;
  speedLimitValidation: {
    applicable: boolean;
    allowed: boolean;
    reasonCode: string | null;
    limitUmS: number | null;
  };
  ammunitionChange: {
    tubeId: number | null;
    torpedoModelId: string | null;
    before: "LOADED" | "EMPTY";
    after: "LOADED" | "EMPTY";
  } | null;
  rngDecision: {
    streamId: string | null;
    draw: number | null;
    drawBp: number | null;
  } | null;
  damageEffects: {
    structuralDamage: number;
    flotationDamage: number;
    floodingSourcesCreated: number;
    terminalTransition: string | null;
    reasonCode: string | null;
  };
  persists: boolean;
  formulaVersion: string;
  rulesetVersion: string;
  recordHash: string;
}

export type TorpedoRecordBody = Omit<TorpedoRecord, "recordHash">;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function invariant(recordId: string, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    recordId,
    field,
    reason,
    value,
  });
}

export function torpedoRecordId(o: {
  battleId: string;
  minute: number;
  substep: number;
  kind: TorpedoRecordKind;
  sourceId: string;
  targetId: string;
  discriminator?: string;
}): string {
  const base = `${o.battleId}:${o.minute}:${o.substep}:torpedo_${o.kind.toLowerCase()}:${o.sourceId}:${o.targetId}`;
  return o.discriminator ? `${base}:${o.discriminator}` : base;
}

export function assertTorpedoRecordSurface(r: TorpedoRecord): void {
  const id = isNonEmptyString(r.recordId) ? r.recordId : "?";
  if (!isNonEmptyString(r.recordId))
    invariant(id, "recordId", r.recordId, "recordId must be a non-empty string");
  if (!isTorpedoRecordKind(r.kind))
    invariant(id, "kind", r.kind, "kind must be a canonical §27 kind");
  if (!isInt(r.battleMinute) || r.battleMinute < 0)
    invariant(id, "battleMinute", r.battleMinute, "battle minute must be a non-negative integer");
  if (!isInt(r.substep) || r.substep < 1)
    invariant(id, "substep", r.substep, "substep must be a positive integer");
  if (!isNonEmptyString(r.sourceId))
    invariant(id, "sourceId", r.sourceId, "sourceId must be a non-empty string");
  if (!isNonEmptyString(r.targetId))
    invariant(id, "targetId", r.targetId, "targetId must be a non-empty string");
  if (!isNonEmptyString(r.commandSource))
    invariant(id, "commandSource", r.commandSource, "commandSource must be a non-empty string");
  if (r.legalContactId !== null && !isNonEmptyString(r.legalContactId))
    invariant(id, "legalContactId", r.legalContactId, "legalContactId must be a string or null");
  if (r.torpedoModelId !== null && !isNonEmptyString(r.torpedoModelId))
    invariant(id, "torpedoModelId", r.torpedoModelId, "torpedoModelId must be a string or null");
  if (r.launcherId !== null && !isNonEmptyString(r.launcherId))
    invariant(id, "launcherId", r.launcherId, "launcherId must be a string or null");
  if (r.settingId !== null && !isNonEmptyString(r.settingId))
    invariant(id, "settingId", r.settingId, "settingId must be a string or null");
  if (!Array.isArray(r.solutionInputs))
    invariant(id, "solutionInputs", r.solutionInputs, "solution inputs must be an array");
  for (const s of r.solutionInputs) {
    if (!isNonEmptyString(s.key) || !isInt(s.value))
      invariant(
        id,
        "solutionInputs[]",
        s,
        "every solution input must be { key: string; value: integer }",
      );
  }
  if (r.solutionQualityBp !== null && !isInt(r.solutionQualityBp))
    invariant(id, "solutionQualityBp", r.solutionQualityBp, "solution quality must be an integer");
  if (r.speedLimitValidation === null || typeof r.speedLimitValidation !== "object")
    invariant(id, "speedLimitValidation", r.speedLimitValidation, "speed validation required");
  const { allowed, applicable } = r.speedLimitValidation;
  if (typeof allowed !== "boolean" || typeof applicable !== "boolean")
    invariant(id, "speedLimitValidation", r.speedLimitValidation, "allowed/applicable booleans");
  if (r.ammunitionChange !== null) {
    const am = r.ammunitionChange;
    if (!isInt(am.tubeId ?? -1) || (am.tubeId ?? -1) < 0)
      invariant(id, "ammunitionChange.tubeId", am.tubeId, "tube id must be a non-negative integer");
    if (am.before !== "LOADED" && am.before !== "EMPTY")
      invariant(id, "ammunitionChange.before", am.before, "before must be LOADED or EMPTY");
    if (am.after !== "LOADED" && am.after !== "EMPTY")
      invariant(id, "ammunitionChange.after", am.after, "after must be LOADED or EMPTY");
  }
  if (r.rngDecision !== null) {
    if (!isNonEmptyString(r.rngDecision.streamId ?? ""))
      invariant(id, "rngDecision.streamId", r.rngDecision.streamId, "stream id required");
    if (typeof r.rngDecision.draw !== "number" || r.rngDecision.draw < 0 || r.rngDecision.draw >= 1)
      invariant(id, "rngDecision.draw", r.rngDecision.draw, "draw must be a float within [0,1)");
    if (!isInt(r.rngDecision.drawBp ?? 0))
      invariant(id, "rngDecision.drawBp", r.rngDecision.drawBp, "drawBp must be an integer");
  }
  if (r.damageEffects === null || typeof r.damageEffects !== "object")
    invariant(id, "damageEffects", r.damageEffects, "damage effects required");
  const d = r.damageEffects;
  for (const k of ["structuralDamage", "flotationDamage", "floodingSourcesCreated"] as const) {
    if (!isInt(d[k]) || d[k] < 0)
      invariant(id, `damageEffects.${k}`, d[k], `${k} must be a non-negative integer`);
  }
  if (typeof r.persists !== "boolean")
    invariant(id, "persists", r.persists, "persists must be a boolean");
  if (!isNonEmptyString(r.formulaVersion) || !isNonEmptyString(r.rulesetVersion))
    invariant(id, "versions", r, "formula + ruleset versions are required");
}

export function computeTorpedoRecordHash(body: TorpedoRecordBody): string {
  return createEnvelope("torpedo-record", torpedoPolicyId, body).bodyHash;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== null && typeof v === "object") deepFreeze(v);
    }
  }
  return value;
}

export function makeTorpedoRecord(seed: TorpedoRecordBody): TorpedoRecord {
  assertTorpedoRecordSurface({ ...seed, recordHash: "" } as TorpedoRecord);
  const recordHash = computeTorpedoRecordHash(seed);
  return deepFreeze({ ...seed, recordHash });
}

export function verifyTorpedoRecordHash(r: TorpedoRecord): boolean {
  const { recordHash: _ignored, ...body } = r;
  return computeTorpedoRecordHash(body) === r.recordHash;
}

export const TORPEDO_RECORD_RULESET_VERSION = TORPEDO_RULESET_VERSION;
export const TORPEDO_RECORD_FORMULA_VERSION = TORPEDO_FORMULA_VERSION;
