//packages/combat/src/torpedoes/records.ts
// DESIGN-40 §27 — immutable torpedo records (INC-7, AC-20). Every launch, track,
// detection, detonation, hit, damage package, flooding source, machinery effect,
// system shock, tube hazard, and chain reaction creates ONE immutable record
// carrying the §27 field groups:
//
//   - battle minute and substep;
//   - source and target identifiers;
//   - command source;
//   - legal contact reference;
//   - model, launcher, and setting;
//   - solution inputs and quality;
//   - speed-limit validation;
//   - ammunition changes;
//   - RNG decisions;
//   - damage and persistence effects;
//   - formula and ruleset versions;
//   - record hash.
//
// The record is deeply frozen after construction and its authoritative hash is a
// domain-separated canonical envelope over the NON-hash fields (createEnvelope
// "torpedo-record" + torpedo_v1 — the gunnery eventRecord / damage eventRecord
// precedent, ENGINEERING-CONTRACT hashing). The hash is purely a function of the
// record's own fields; repeated runs and child processes emit identical hashes.
//
// The §28 canonical sequencing of records lives in ordering.ts; the engine
// emits every record into the BattleLedger (each record hash is carried on the
// corresponding BattleEvent.eventHash, so DB/UI/insertion order can never
// influence outcomes).
import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION, torpedoPolicyId } from "./constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

// The §27 record kinds (the DESIGN-40 §27 enumeration; DETECTION is shipped for
// the future detection model — a detection with no model emits no record).
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

// The authoritative §27 record surface. Every field group is explicit; a kind
// that does not engage a group carries null / [] (the group is present and the
// audit shows it was not engaged — no silent omissions).
export interface TorpedoRecord {
  recordId: string; // deterministic (see torpedoRecordId)
  kind: TorpedoRecordKind;
  battleMinute: number;
  substep: number;
  // source + target identifiers
  sourceId: string; // firing ship / launcher / track / package source
  targetId: string; // track id, contact id, or target ship id
  // command source
  commandSource: string;
  // legal contact reference (the §6 fog-gate-legal contact the action used)
  legalContactId: string | null;
  // model, launcher, and setting
  torpedoModelId: string | null;
  launcherId: string | null;
  settingId: string | null;
  // solution inputs (stable { key, value }) + quality (bp; null for area fire)
  solutionInputs: readonly { key: string; value: number }[];
  solutionQualityBp: number | null;
  // speed-limit validation (§7/§8 check point 2 at the firing instant)
  speedLimitValidation: {
    applicable: boolean;
    allowed: boolean;
    reasonCode: string | null;
    limitUmS: number | null;
  };
  // ammunition change (the consumed tube/model marker; null when none)
  ammunitionChange: {
    tubeId: number | null;
    torpedoModelId: string | null;
    before: "LOADED" | "EMPTY";
    after: "LOADED" | "EMPTY";
  } | null;
  // RNG decision (the single keyed draw this record consumed, if any)
  rngDecision: {
    streamId: string | null;
    draw: number | null; // the raw float [0,1) when a draw occurred
    drawBp: number | null; // the floored integer basis-point draw
  } | null;
  // damage + persistence effects (zero/empty when this record is not damage)
  damageEffects: {
    structuralDamage: number;
    flotationDamage: number;
    floodingSourcesCreated: number;
    terminalTransition: string | null;
    reasonCode: string | null;
  };
  // persistence: damage/flooding/machinery/shock/hazard/chain-reaction persist
  // into campaign state (§26); launch/track/hit/detonation records do not.
  persists: boolean;
  formulaVersion: string;
  rulesetVersion: string;
  recordHash: string; // authoritative SHA-256 envelope
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

/** Deterministic record id — purely a function of the record's identity fields,
 *  so repeated runs and child processes emit identical ids (the gunneryEventId
 *  idiom).
 *
 *  `discriminator` (optional) disambiguates records whose identity fields are
 *  otherwise identical at the same instant — specifically the §22 chain
 *  explosion's DAMAGE/FLOODING_SOURCE/MACHINERY/SYSTEM_SHOCK records, which
 *  share the source track id and target ship with the primary §21 package that
 *  detonated them (reviewer BLOCKER-1). Appending the discriminator keeps every
 *  §27 recordId globally unique without weakening the collision-free guarantee. */
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

// AC-20: surface guard — every §27 field well-formed; a malformed record fails
// closed with TORPEDO_STATE_INVARIANT_FAILED (EXCEPT the recordHash presence, a
// hash-less body is validated before hashing). Reversible-to-invariant.
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

/** AC-20: authoritative record hash — domain-separated canonical envelope keyed
 *  to the torpedo_v1 compatibility version, over the record's non-hash fields. */
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

/** AC-20: build an immutable (deeply-frozen) §27 record with its authoritative
 *  hash. The version fields are pinned to the shipped torpedo_v1 versions. */
export function makeTorpedoRecord(seed: TorpedoRecordBody): TorpedoRecord {
  assertTorpedoRecordSurface({ ...seed, recordHash: "" } as TorpedoRecord);
  const recordHash = computeTorpedoRecordHash(seed);
  return deepFreeze({ ...seed, recordHash });
}

/** AC-20: verify a record hash (recompute + compare; tamper fails). */
export function verifyTorpedoRecordHash(r: TorpedoRecord): boolean {
  const { recordHash: _ignored, ...body } = r;
  return computeTorpedoRecordHash(body) === r.recordHash;
}

// The shipped reference for the §27 version fields (exported so the resolver and
// tests never pin a divergent literal).
export const TORPEDO_RECORD_RULESET_VERSION = TORPEDO_RULESET_VERSION;
export const TORPEDO_RECORD_FORMULA_VERSION = TORPEDO_FORMULA_VERSION;
