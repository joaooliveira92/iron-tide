import { createEnvelope } from "@bluewave/deterministic";
import { type ComponentDamageResult } from "./componentDamage.js";
import { type StructureFlotationResult } from "./structureFlotation.js";
import { type FireSourceRecord, type FloodingSourceRecord } from "./state.js";

export interface ProtectionInteractionRecord {
  effectiveResistanceUm: number;
  penetrationMargin: number;
  outcome: string;
}

export interface DamageEventRecord {
  battleMinute: number;
  substep: number;
  sourceId: string;
  targetShipId: string;
  causalWeaponId: string;
  hitLocation: string;
  protectionInteraction: ProtectionInteractionRecord;
  componentEffects: ComponentDamageResult[];
  structureFlotationEffects: StructureFlotationResult;
  createdFireSources: FireSourceRecord[];
  createdFloodingSources: FloodingSourceRecord[];
  terminalTransition: string | null;
  recordHash: string;
}

export type DamageEventRecordBody = Omit<DamageEventRecord, "recordHash">;

export function computeDamageEventHash(body: DamageEventRecordBody): string {
  return createEnvelope("damage-event", "damage_v1", body).bodyHash;
}

export function createDamageEventRecord(params: DamageEventRecordBody): DamageEventRecord {
  const recordHash = computeDamageEventHash(params);
  const record: DamageEventRecord = { ...params, recordHash };
  return deepFreeze(record);
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
