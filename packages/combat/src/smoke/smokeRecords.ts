// DESIGN-42 §30 — immutable SmokeEventRecord with deterministic hash.
// Each record captures a single smoke lifecycle event: drift/decay, intersection,
// funnel emission, smokescreen generation, float deployment, generator activation,
// source merge, or source removal.
// Pure/deterministic: hash via @bluewave/deterministic createEnvelope
// with domain "smoke-event" and version "smoke_v1".
import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  SMOKE_RULESET_VERSION,
  SMOKE_FORMULA_VERSION,
  smokePolicyId,
  type SmokeSourceType,
} from "./constants.js";
import { SMOKE_RESOLUTION_DEFERRED } from "./reasonCodes.js";

// SmokeRecordKind — the canonical §30 record kinds

export const SMOKE_RECORD_KINDS = [
  "DRIFT_DECAY",
  "LINE_INTERSECTION",
  "FUNNEL_EMISSION",
  "SMOKESCREEN_GENERATION",
  "FLOAT_DEPLOYMENT",
  "GENERATOR_ACTIVATION",
  "SMOKE_SOURCE_MERGE",
  "SMOKE_SOURCE_REMOVAL",
] as const;
export type SmokeRecordKind = (typeof SMOKE_RECORD_KINDS)[number];

export function isSmokeRecordKind(v: string): v is SmokeRecordKind {
  return (SMOKE_RECORD_KINDS as readonly string[]).includes(v);
}

// SmokeEventRecord — the authoritative record surface

export interface SmokeEventRecord {
  readonly recordId: string;
  readonly kind: SmokeRecordKind;
  readonly battleMinute: number;
  readonly substep: number;
  readonly sourceType: SmokeSourceType;
  readonly sourceId: string;
  readonly cloudId: string;
  readonly position: readonly [number, number];
  readonly densityBp: number;
  readonly weatherContext: {
    readonly windSpeedKnots: number;
    readonly windDirection: number;
    readonly precipitationIntensityBp: number;
  } | null;
  readonly formulaVersion: string;
  readonly rulesetVersion: string;
  readonly recordHash: string;
}

export type SmokeEventRecordBody = Omit<SmokeEventRecord, "recordHash">;

// Validation helpers

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function invariant(recordId: string, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(SMOKE_RESOLUTION_DEFERRED, {
    code: SMOKE_RESOLUTION_DEFERRED,
    recordId,
    field,
    reason,
    value,
  });
}

// Surface guard

export function assertSmokeEventRecordSurface(r: SmokeEventRecord): void {
  const id = isNonEmptyString(r.recordId) ? r.recordId : "?";
  if (!isNonEmptyString(r.recordId))
    invariant(id, "recordId", r.recordId, "recordId must be a non-empty string");
  if (!isSmokeRecordKind(r.kind))
    invariant(id, "kind", r.kind, "kind must be a canonical §30 kind");
  if (!isInt(r.battleMinute) || r.battleMinute < 0)
    invariant(id, "battleMinute", r.battleMinute, "battleMinute must be a non-negative integer");
  if (!isInt(r.substep) || r.substep < 0)
    invariant(id, "substep", r.substep, "substep must be a non-negative integer");
  if (!isNonEmptyString(r.sourceType as string))
    invariant(id, "sourceType", r.sourceType, "sourceType must be a non-empty string");
  if (!isNonEmptyString(r.sourceId))
    invariant(id, "sourceId", r.sourceId, "sourceId must be a non-empty string");
  if (!isNonEmptyString(r.cloudId))
    invariant(id, "cloudId", r.cloudId, "cloudId must be a non-empty string");
  if (!Array.isArray(r.position) || r.position.length !== 2)
    invariant(id, "position", r.position, "position must be a [number, number] tuple");
  if (!isInt(r.densityBp) || r.densityBp < 0 || r.densityBp > 10_000)
    invariant(id, "densityBp", r.densityBp, "densityBp must be an integer in [0, 10000]");
  if (r.weatherContext !== null) {
    const w = r.weatherContext;
    if (typeof w.windSpeedKnots !== "number")
      invariant(
        id,
        "weatherContext.windSpeedKnots",
        w.windSpeedKnots,
        "windSpeedKnots must be a number",
      );
    if (typeof w.windDirection !== "number")
      invariant(
        id,
        "weatherContext.windDirection",
        w.windDirection,
        "windDirection must be a number",
      );
    if (!isInt(w.precipitationIntensityBp))
      invariant(
        id,
        "weatherContext.precipitationIntensityBp",
        w.precipitationIntensityBp,
        "precipitationIntensityBp must be an integer",
      );
  }
  if (!isNonEmptyString(r.formulaVersion))
    invariant(id, "formulaVersion", r.formulaVersion, "formulaVersion must be a non-empty string");
  if (!isNonEmptyString(r.rulesetVersion))
    invariant(id, "rulesetVersion", r.rulesetVersion, "rulesetVersion must be a non-empty string");
}

// Deterministic record ID

export function smokeEventRecordId(o: {
  battleMinute: number;
  substep: number;
  kind: SmokeRecordKind;
  sourceId: string;
  cloudId: string;
  discriminator?: string;
}): string {
  const base = `${o.battleMinute}:${o.substep}:smoke_${o.kind.toLowerCase()}:${o.sourceId}:${o.cloudId}`;
  return o.discriminator ? `${base}:${o.discriminator}` : base;
}

// Hash computation

export function computeSmokeEventHash(body: SmokeEventRecordBody): string {
  return createEnvelope("smoke-event", smokePolicyId, body).bodyHash;
}

// Deep freeze

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

// Factory — build an immutable (deeply-frozen) SmokeEventRecord

export function createSmokeEventRecord(params: {
  kind: SmokeRecordKind;
  battleMinute: number;
  substep: number;
  sourceType: SmokeSourceType;
  sourceId: string;
  cloudId: string;
  position: readonly [number, number];
  densityBp: number;
  weatherContext?: {
    windSpeedKnots: number;
    windDirection: number;
    precipitationIntensityBp: number;
  } | null;
}): SmokeEventRecord {
  const body: SmokeEventRecordBody = {
    recordId: smokeEventRecordId({
      battleMinute: params.battleMinute,
      substep: params.substep,
      kind: params.kind,
      sourceId: params.sourceId,
      cloudId: params.cloudId,
    }),
    kind: params.kind,
    battleMinute: params.battleMinute,
    substep: params.substep,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    cloudId: params.cloudId,
    position: params.position,
    densityBp: params.densityBp,
    weatherContext: params.weatherContext ?? null,
    formulaVersion: SMOKE_FORMULA_VERSION,
    rulesetVersion: SMOKE_RULESET_VERSION,
  };

  // Validate surface (before hash computation)
  const tempRecord: SmokeEventRecord = { ...body, recordHash: "" };
  assertSmokeEventRecordSurface(tempRecord);

  const recordHash = computeSmokeEventHash(body);
  return deepFreeze({ ...body, recordHash });
}

// Verify record hash

export function verifySmokeEventRecordHash(r: SmokeEventRecord): boolean {
  const { recordHash: _ignored, ...body } = r;
  return computeSmokeEventHash(body) === r.recordHash;
}
