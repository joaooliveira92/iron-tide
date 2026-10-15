// DESIGN-39 §30 + AC-8: the immutable GunneryEventRecord produced by every salvo /
// AA burst. Carries all §30 fields (battle minute + substep; battery/shooter/target
// contact ids; command source; fire mode; ammunition; accuracy + rate factors;
// random decisions; impact/armor inputs (reserved this slice); outcome (HIT/MISS,
// penetration deferred); damage-event references (reserved); formula + ruleset
// versions; event hash via the @bluewave/deterministic canonical envelope using the
// gunnery_v1 compatibility version). Immutable: frozen after construction; hash
// derived only from the record's own fields.
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

export type GunneryOutcome = "HIT" | "MISS";

// impact/armor inputs are a reserved slot this slice (DESIGN-39 §21-24, B-4 armor
// track); the event carries an explicit placeholder rather than omitting it.
export type ImpactArmorInputs = Record<string, never> | null;

export interface AmmunitionAccountSnapshot {
  type: AmmunitionType;
  rounds: number; // rounds reserved + consumed
  before: number;
  after: number;
}

/**
 * The first-class armament identity a salvo fired under (ADR-0093 Step 4). Present only for batteries
 * projected from a compiled design carrying a `CompiledArmamentMount` snapshot; absent for legacy designs.
 */
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
  shooterId: string; // observing ship / owner ship carrying the battery
  targetContactId: string;
  commandSource: string;
  fireMode: FireMode;
  ammunition: AmmunitionAccountSnapshot;
  accuracy: AccuracyResolution;
  rate: EffectiveReloadResolution;
  randomDecisions: readonly KeyedHitDraw[];
  impactInputs: ImpactArmorInputs; // reserved this slice
  outcome: GunneryOutcome; // penetration/armor outcome deferred to B-4
  damageEventRefs: readonly string[]; // reserved this slice (B-4 damage track)
  /** First-class armament identity (ADR-0093 Step 4); absent on the legacy compatibility path. */
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

// The full record body over which the authoritative hash is computed: the record
// sans its derived eventHash (formula + ruleset versions are §30 fields and are
// included in the hashed body).
export type GunneryEventRecordBody = Omit<GunneryEventRecord, "eventHash">;

// Canonical event id: purely a function of the record's identifying fields, so
// repeated runs and child processes emit identical ids (determinism contract).
export function gunneryEventId(o: {
  battleId: string;
  minute: number;
  substep: number;
  batteryId: string;
  targetContactId: string;
}): string {
  return `${o.battleId}:${o.minute}:${o.substep}:gunnery_salvo:${o.batteryId}:${o.targetContactId}`;
}

// AC-8: authoritative event hash — domain-separated canonical envelope keyed to
// the gunnery_v1 compatibility version, over the record's non-hash fields.
export function computeGunneryEventHash(body: GunneryEventRecordBody): string {
  return createEnvelope("gunnery-event", gunneryPolicyId, body).bodyHash;
}

// AC-8: build an immutable (deeply-frozen) GunneryEventRecord with its event hash.
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

// DESIGN-39 §31 canonical ordering: tactical sides → shooting ships by id →
// batteries → target contacts (mounts/shot/impact/damage levels apply to later
// slices; this slice emits one salvo record per battery per minute). DB/UI/
// rendering/wall-clock insertion order must never affect outcomes.
export function gunneryEventOrder(a: GunneryEventRecord, b: GunneryEventRecord): number {
  return (
    a.minute - b.minute ||
    a.substep - b.substep ||
    a.shooterId.localeCompare(b.shooterId) ||
    a.batteryId.localeCompare(b.batteryId) ||
    a.targetContactId.localeCompare(b.targetContactId) ||
    a.eventId.localeCompare(b.eventId)
  );
}
