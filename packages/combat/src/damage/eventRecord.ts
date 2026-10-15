// DESIGN-41 §45 — Immutable DamageEventRecord with deterministic hash.
// The record captures every effect of a single hit resolution: location,
// protection interaction, component damage, structure/flotation, fire
// and flooding sources, and terminal transitions.
// Pure/deterministic: hash via @bluewave/deterministic createEnvelope
// with domain "damage-event" and version "damage_v1".
import { createEnvelope } from "@bluewave/deterministic";
import { type ComponentDamageResult } from "./componentDamage.js";
import { type StructureFlotationResult } from "./structureFlotation.js";
import { type FireSourceRecord, type FloodingSourceRecord } from "./state.js";

// DamageEventRecord

export interface ProtectionInteractionRecord {
  effectiveResistanceUm: number;
  penetrationMargin: number;
  outcome: string;
}

export interface DamageEventRecord {
  /** Battle minute of the event. */
  battleMinute: number;
  /** Substep within the minute. */
  substep: number;
  /** Id of the source (shooter/weapon system). */
  sourceId: string;
  /** Id of the target ship. */
  targetShipId: string;
  /** Id of the weapon that caused the damage. */
  causalWeaponId: string;
  /** The hit location description/zone id. */
  hitLocation: string;
  /** Protection interaction details. */
  protectionInteraction: ProtectionInteractionRecord;
  /** Component damage effects (ordered by component id). */
  componentEffects: ComponentDamageResult[];
  /** Structure and flotation effects. */
  structureFlotationEffects: StructureFlotationResult;
  /** Fire sources created (may be empty). */
  createdFireSources: FireSourceRecord[];
  /** Flooding sources created (may be empty). */
  createdFloodingSources: FloodingSourceRecord[];
  /** Terminal transition (null if no transition). */
  terminalTransition: string | null;
  /** Authoritative deterministic hash (set by createDamageEventRecord). */
  recordHash: string;
}

// The body over which the hash is computed (everything except recordHash).
export type DamageEventRecordBody = Omit<DamageEventRecord, "recordHash">;

// Hash computation

/**
 * Compute the deterministic hash for a damage event record body.
 * Uses `createEnvelope` from @bluewave/deterministic with domain "damage-event"
 * and version "damage_v1".
 *
 * @param body - The record body (all fields except recordHash).
 * @returns The sha256 hex digest from the canonical envelope.
 */
export function computeDamageEventHash(body: DamageEventRecordBody): string {
  return createEnvelope("damage-event", "damage_v1", body).bodyHash;
}

// Factory

/**
 * Create a fully-populated DamageEventRecord with its authoritative hash.
 * The record is immutable (frozen) after construction.
 *
 * @param params - All fields except recordHash.
 * @returns A frozen DamageEventRecord with recordHash set.
 */
export function createDamageEventRecord(params: DamageEventRecordBody): DamageEventRecord {
  const recordHash = computeDamageEventHash(params);
  const record: DamageEventRecord = { ...params, recordHash };
  return deepFreeze(record);
}

// ---- Internal helpers ----

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
