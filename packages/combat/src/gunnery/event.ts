import { createEnvelope } from "@bluewave/deterministic";
import type { KeyedHitDraw, AccuracyResolution } from "./accuracy.js";
import {
  type AmmunitionType,
  type FireMode,
  gunneryPolicyId,
  GUNNERY_FORMULA_VERSION,
  GUNNERY_RULESET_VERSION,
} from "./constants.js";
import type { EffectiveReloadResolution } from "./rateOfFire.js";
import { compareStrings } from "../core/ordering.js";

export type GunneryOutcome = "HIT" | "MISS";

export type ImpactArmorInputs = Record<string, never> | null;

export interface AmmunitionAccountSnapshot {
  type: AmmunitionType;
  rounds: number;
  before: number;
  after: number;
}

export interface GunneryWeaponIdentity {
  readonly gunFamilyId?: string;
  readonly gunModelId: string;
  readonly mountId: string;
  readonly ammunitionId?: string;
}

export interface GunneryEventRecord {
  eventId: string;
  battleId: string;
  minute: number;
  substep: number;
  batteryId: string;
  shooterId: string;
  targetContactId: string;
  commandSource: string;
  fireMode: FireMode;
  ammunition: AmmunitionAccountSnapshot;
  accuracy: AccuracyResolution;
  rate: EffectiveReloadResolution;
  randomDecisions: readonly KeyedHitDraw[];
  impactInputs: ImpactArmorInputs;
  outcome: GunneryOutcome;
  damageEventRefs: readonly string[];
  weaponIdentity?: GunneryWeaponIdentity;
  formulaVersion: string;
  rulesetVersion: string;
  eventHash: string;
}

export interface GunneryEventSeed {
  eventId: string;
  battleId: string;
  minute: number;
  substep: number;
  batteryId: string;
  shooterId: string;
  targetContactId: string;
  commandSource: string;
  fireMode: FireMode;
  ammunition: AmmunitionAccountSnapshot;
  accuracy: AccuracyResolution;
  rate: EffectiveReloadResolution;
  randomDecisions: readonly KeyedHitDraw[];
  impactInputs?: ImpactArmorInputs;
  outcome: GunneryOutcome;
  damageEventRefs?: readonly string[];
  weaponIdentity?: GunneryWeaponIdentity;
}

export type GunneryEventRecordBody = Omit<GunneryEventRecord, "eventHash">;

export function gunneryEventId(o: {
  battleId: string;
  minute: number;
  substep: number;
  batteryId: string;
  targetContactId: string;
}): string {
  return `${o.battleId}:${o.minute}:${o.substep}:gunnery_salvo:${o.batteryId}:${o.targetContactId}`;
}

export function computeGunneryEventHash(body: GunneryEventRecordBody): string {
  return createEnvelope("gunnery-event", gunneryPolicyId, body).bodyHash;
}

export function makeGunneryEventRecord(seed: GunneryEventSeed): GunneryEventRecord {
  const { impactInputs, damageEventRefs, ...rest } = seed;
  const base: GunneryEventRecordBody = {
    ...rest,
    impactInputs: impactInputs ?? null,
    damageEventRefs: damageEventRefs ?? [],
    formulaVersion: GUNNERY_FORMULA_VERSION,
    rulesetVersion: GUNNERY_RULESET_VERSION,
  };
  const eventHash = computeGunneryEventHash(base);
  return deepFreeze({ ...base, eventHash });
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

export function gunneryEventOrder(a: GunneryEventRecord, b: GunneryEventRecord): number {
  return (
    a.minute - b.minute ||
    a.substep - b.substep ||
    compareStrings(a.shooterId, b.shooterId) ||
    compareStrings(a.batteryId, b.batteryId) ||
    compareStrings(a.targetContactId, b.targetContactId) ||
    compareStrings(a.eventId, b.eventId)
  );
}
