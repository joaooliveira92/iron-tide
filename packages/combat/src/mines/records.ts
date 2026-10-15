// DESIGN-35 §28 — immutable Monthly Resolution Record (INC-8, AC-20).
//
// Every monthly mine-warfare resolution creates ONE immutable
// `MineWarfareResolutionRecord` containing every §28 field group:
// area/war contexts, opening pressure records, laying sources/values, sweeping
// ships/modes/values, dual-equipment reductions, allocated sweeping, pressure
// removed, battle/route probabilities, strike decisions/outcomes, standoff
// levels, decay, post-war/ownership dispositions, reports/knowledge changes,
// friendly-fire checks, inventory/war-score/political/damage effects, RNG
// decisions, ruleset + formula versions, and an authoritative record hash.
//
// DEFERRAL SLICE (ticket 03/05): mine-strike resolution, battle-hazard
// generation, and friendly-fire risk are OWNED BY THE C-2 CONTINUATION, so the
// sub-records below ship as EXPLICITLY-TYPED, EXPLICITLY-EMPTY collections —
// never omitted, never `undefined` — so the continuation has a stable field to
// populate without a breaking type change (the INC-8 ticket's assembler hint):
//
//   - battleAndRouteProbabilities.battle ....... EXPLICIT empty this slice;
//   - strikeDecisionsAndOutcomes ............... EXPLICIT empty this slice;
//   - friendlyFireChecks ........................ EXPLICIT empty this slice.
//
// The record is deeply frozen after construction and its authoritative hash is
// a domain-separated canonical envelope over the NON-hash fields
// (createEnvelope domain "mine_warfare_resolution" / compatibility version
// "mine_warfare_resolution_v1" — the torpedo-record precedent,
// ENGINEERING-CONTRACT hashing). The hash is purely a function of the record's
// own fields; identical state + inputs + seeds produce identical records and
// hashes across processes (AC-23 / §31 item 25).
//
// Assembly order: every collection is canonically SORTED by DESIGN-35 §29
// (ordering.ts comparators) INSIDE the assembler — DB/UI/wall-clock insertion
// order can never affect the record or its hash. Pure/deterministic: no
// I/O/clock/random; the RNG decisions are recorded by the caller's keyed
// streams and passed in.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { type RandomDecision } from "@bluewave/random";
import {
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  MINE_TYPES,
  type MineType,
} from "./constants.js";
import { type DefensiveStandoffLevel } from "./defensive-standoff.js";
import {
  canonicallySorted,
  compareAllocatedSweepingBySection10,
  compareAreasById,
  compareEffectsByDeclaredOrdinal,
  compareLayingSourcesById,
  compareMinePressureRecords,
  compareRouteChecksByRouteEdgeId,
  compareMineStrings,
  compareSweepingShipsById,
} from "./ordering.js";
import {
  assertAreaMinePressureRecordSurface,
  type AreaMinePressureRecord,
} from "./pressure-record.js";
import { MINE_WARFARE_INVARIANT_FAILED } from "./reasonCodes.js";

export const mineWarfareResolutionPolicyId = "mine_warfare_resolution_v1" as const;

export interface MineWarfareResolutionContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  /** §28 sub-records explicitly deferred to the C-2 continuation (empty here). */
  deferredSubRecordCollections: readonly string[];
}

export const SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT: MineWarfareResolutionContract = {
  policyId: mineWarfareResolutionPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  deferredSubRecordCollections: [
    "battleAndRouteProbabilities.battle",
    "strikeDecisionsAndOutcomes",
    "friendlyFireChecks",
  ],
};

function contractMismatch(c: unknown, reason: string): never {
  throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
    code: MINE_WARFARE_INVARIANT_FAILED,
    contract: c,
    reason,
  });
}

// AC-24: fail-closed guard over the §28 resolution contract itself.
export function validateMineWarfareResolutionContract(
  c: Partial<MineWarfareResolutionContract> | null | undefined,
): asserts c is MineWarfareResolutionContract {
  if (!c) contractMismatch(c, "mine_warfare_resolution_v1 missing contract");
  if (c.policyId !== mineWarfareResolutionPolicyId)
    contractMismatch(c, "mine_warfare_resolution_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    contractMismatch(c, "mine_warfare_resolution_v1 ruleset/formula versions");
  if (!c.deferredSubRecordCollections || c.deferredSubRecordCollections.length !== 3)
    contractMismatch(c, "mine_warfare_resolution_v1 deferred sub-record collection list");
  for (const name of c.deferredSubRecordCollections) {
    if (
      name !== "battleAndRouteProbabilities.battle" &&
      name !== "strikeDecisionsAndOutcomes" &&
      name !== "friendlyFireChecks"
    )
      contractMismatch(c, `mine_warfare_resolution_v1 unknown deferred collection ${name}`);
  }
}

// §28 sub-record shapes (explicitly typed; the deferred ones are only ever
// constructed as empty arrays this slice — but the TYPE exists so the
// continuation populates them without a breaking change).

export interface AreaAndWarContext {
  areaId: string;
  warIds: readonly string[];
}

export interface LayingSourceAndValue {
  source: string;
  layingParticipant: string;
  area: string;
  /** Effective laying value contributed this month (integer >= 0, §4). */
  value: number;
  month: SafeMonth;
}

export interface SweepingShipModeValue {
  shipId: string;
  /** §8 equipment mode literal (single-purpose string or a dual-equipment mode). */
  equipmentMode: string;
  /** The effective sweeping value used by the §10 aggregation (integer >= 0). */
  sweepingValue: number;
}

export interface AllocatedSweeping {
  minePressureId: string;
  sweptPressure: SafeInt;
  typeAdjustedSweeping: SafeInt;
  pressureAfter: SafeInt;
  /**
   * §10 canonical-order keys materialized EXACTLY once (never recomputed during
   * a sort). §29 item 6 orders sweep allocation by §10's five-part order, so the
   * record keeps the keys the aggregation computed. `pressure = sweptPressure +
   * pressureAfter` is derivable from the three pressure fields above; the callers
   * who assembled the §10 order provide these keys.
   */
  mineTypeId: MineType;
  /** §10 key 1: controlled-defensive mines threatening the sweeping side. */
  threatensSweepingSide: boolean;
  /** §10 key 2: current strike-risk priority (higher = higher risk = earlier). */
  strikeRiskPriority: number;
}

export interface RouteProbability {
  routeEdgeId: string;
  routeRiskBp: SafeInt;
}

/** EXPLICIT empty this slice — battle hazards deferred (§11, C-2 continuation). */
export interface BattleProbability {
  battleId: string;
  targetId: string;
  hazardBp: SafeInt;
}

/** EXPLICIT empty this slice — strike resolution deferred (§14–15/§17–18). */
export interface StrikeDecisionAndOutcome {
  targetId: string;
  decidedOutcome: string;
  severityBp: SafeInt;
}

export interface StandoffLevel {
  minePressureId: string;
  level: DefensiveStandoffLevel;
  utilityMultiplierBp: number | null;
}

export interface DecayRecord {
  minePressureId: string;
  retentionMultiplierBp: number;
  decayedPressure: SafeInt;
  pressureAfterDecay: SafeInt;
}

export interface PostWarOwnershipDisposition {
  minePressureId: string;
  disposition: string;
}

export interface ReportKnowledgeChange {
  reportId: string;
  participantId: string;
}

/** EXPLICIT empty — friendly-fire checks deferred (§25 –26, C-2 continuation). */
export interface FriendlyMineFireCheck {
  shipId: string;
  minePressureId: string;
  riskBp: SafeInt;
}

export interface MineWarfareEffect {
  /** §29 level 9 declared effect ordinal. */
  ordinal: number;
  /** Stable effect id (e.g. "inv:CONTACT:-20", "warsrc:+3"). */
  stableId: string;
  /** Inventory / war-score / political / damage change description. */
  description: string;
}

// the §28 record surface

export interface MineWarfareResolutionRecord {
  month: SafeInt;
  areaAndWarContexts: readonly AreaAndWarContext[];
  openingPressureRecords: readonly AreaMinePressureRecord[];
  layingSourcesAndValues: readonly LayingSourceAndValue[];
  sweepingShipsModesValues: readonly SweepingShipModeValue[];
  dualEquipmentReductions: readonly string[];
  allocatedSweeping: readonly AllocatedSweeping[];
  pressureRemoved: SafeInt;
  battleAndRouteProbabilities: {
    /** Route checks — SORTED by route edge id (§29 level 7). */
    routes: readonly RouteProbability[];
    /** EXPLICIT EMPTY this slice. */
    battle: readonly BattleProbability[];
  };
  /** EXPLICIT EMPTY this slice. */
  strikeDecisionsAndOutcomes: readonly StrikeDecisionAndOutcome[];
  standoffLevels: readonly StandoffLevel[];
  decay: readonly DecayRecord[];
  postWarAndOwnershipDispositions: readonly PostWarOwnershipDisposition[];
  reportsAndKnowledgeChanges: readonly ReportKnowledgeChange[];
  /** EXPLICIT EMPTY this slice. */
  friendlyFireChecks: readonly FriendlyMineFireCheck[];
  inventoryWarScorePoliticalAndDamageEffects: readonly MineWarfareEffect[];
  rngDecisions: readonly RandomDecision[];
  rulesetVersion: string;
  formulaVersion: string;
  recordHash: string;
}

export type MineWarfareResolutionRecordBody = Omit<MineWarfareResolutionRecord, "recordHash">;

// fail-closed validation of every group

function isSafeMonth(v: unknown): v is SafeInt {
  return SafeInt.isSafeInt(v as number) && (v as SafeInt) >= 0;
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isIntValue(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function raiseInvariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
    code: MINE_WARFARE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

/** AC-20: fail-closed surface guard — every §28 field group well-formed; a
 *  malformed record fails with MINE_WARFARE_INVARIANT_FAILED (EXCEPT the
 *  recordHash, which is validated before hashing). Reversible-to-invariant. */
export function assertMineWarfareResolutionRecordSurface(r: MineWarfareResolutionRecord): void {
  validateMineWarfareResolutionContract(SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT);
  if (!isSafeMonth(r.month))
    raiseInvariant("month", r.month, "month must be a non-negative SafeInt");
  if (!Array.isArray(r.areaAndWarContexts))
    raiseInvariant("areaAndWarContexts", r.areaAndWarContexts, "must be an array");
  for (let i = 0; i < r.areaAndWarContexts.length; i++) {
    const ctx = r.areaAndWarContexts[i] as AreaAndWarContext | null | undefined;
    if (!ctx || !isNonEmptyString(ctx.areaId))
      raiseInvariant(`areaAndWarContexts[${i}]`, ctx, "area id required");
    if (!Array.isArray(ctx.warIds) || !ctx.warIds.every(isNonEmptyString))
      raiseInvariant(`areaAndWarContexts[${i}].warIds`, ctx, "war ids must be non-empty strings");
  }
  if (!Array.isArray(r.openingPressureRecords))
    raiseInvariant("openingPressureRecords", r.openingPressureRecords, "must be an array");
  for (let i = 0; i < r.openingPressureRecords.length; i++) {
    assertAreaMinePressureRecordSurface(r.openingPressureRecords[i]); // throws INVALID_MINE_PRESSURE_STATE
  }
  if (!Array.isArray(r.layingSourcesAndValues))
    raiseInvariant("layingSourcesAndValues", r.layingSourcesAndValues, "must be an array");
  for (let i = 0; i < r.layingSourcesAndValues.length; i++) {
    const l = r.layingSourcesAndValues[i] as LayingSourceAndValue | null | undefined;
    if (
      !l ||
      !isNonEmptyString(l.source) ||
      !isNonEmptyString(l.layingParticipant) ||
      !isNonEmptyString(l.area) ||
      !isIntValue(l.value) ||
      l.value < 0 ||
      !isSafeMonth(l.month)
    )
      raiseInvariant(`layingSourcesAndValues[${i}]`, l, "malformed §28 laying source/value");
  }
  if (!Array.isArray(r.sweepingShipsModesValues))
    raiseInvariant("sweepingShipsModesValues", r.sweepingShipsModesValues, "must be an array");
  for (let i = 0; i < r.sweepingShipsModesValues.length; i++) {
    const s = r.sweepingShipsModesValues[i] as Record<string, unknown> | null | undefined;
    if (
      !s ||
      !isNonEmptyString(s.shipId) ||
      !isNonEmptyString(s.equipmentMode) ||
      !isIntValue(s.sweepingValue) ||
      (s.sweepingValue as number) < 0
    )
      raiseInvariant(`sweepingShipsModesValues[${i}]`, s, "malformed §28 sweeping-ship entry");
  }
  if (
    !Array.isArray(r.dualEquipmentReductions) ||
    !r.dualEquipmentReductions.every(isNonEmptyString)
  )
    raiseInvariant(
      "dualEquipmentReductions",
      r.dualEquipmentReductions,
      "non-empty strings required",
    );
  if (!Array.isArray(r.allocatedSweeping))
    raiseInvariant("allocatedSweeping", r.allocatedSweeping, "must be an array");
  for (let i = 0; i < r.allocatedSweeping.length; i++) {
    const a = r.allocatedSweeping[i] as Record<string, unknown> | null | undefined;
    if (
      !a ||
      !isNonEmptyString(a.minePressureId) ||
      !isSafeMonth(a.sweptPressure) ||
      !isSafeMonth(a.typeAdjustedSweeping) ||
      !isSafeMonth(a.pressureAfter) ||
      !(MINE_TYPES as readonly string[]).includes(a.mineTypeId as string) ||
      typeof a.threatensSweepingSide !== "boolean" ||
      typeof a.strikeRiskPriority !== "number" ||
      !Number.isInteger(a.strikeRiskPriority)
    )
      raiseInvariant(
        `allocatedSweeping[${i}]`,
        a,
        "malformed §10 allocation entry (incl. §10 order keys)",
      );
  }
  if (!isSafeMonth(r.pressureRemoved))
    raiseInvariant("pressureRemoved", r.pressureRemoved, "must be a non-negative SafeInt");
  if (!r.battleAndRouteProbabilities || typeof r.battleAndRouteProbabilities !== "object")
    raiseInvariant("battleAndRouteProbabilities", r.battleAndRouteProbabilities, "object required");
  if (!Array.isArray(r.battleAndRouteProbabilities.routes))
    raiseInvariant("battleAndRouteProbabilities.routes", null, "routes must be an array");
  for (let i = 0; i < r.battleAndRouteProbabilities.routes.length; i++) {
    const p = r.battleAndRouteProbabilities.routes[i] as Record<string, unknown> | null | undefined;
    if (!p || !isNonEmptyString(p.routeEdgeId) || !isSafeMonth(p.routeRiskBp))
      raiseInvariant(
        `battleAndRouteProbabilities.routes[${i}]`,
        p,
        "malformed §13 route probability",
      );
  }
  if (
    !Array.isArray(r.battleAndRouteProbabilities.battle) ||
    r.battleAndRouteProbabilities.battle.length !== 0
  )
    raiseInvariant(
      "battleAndRouteProbabilities.battle",
      r.battleAndRouteProbabilities.battle,
      "EXPLICIT empty this slice (battle-linking deferred) — populated by the C-2 continuation",
    );
  if (!Array.isArray(r.strikeDecisionsAndOutcomes) || r.strikeDecisionsAndOutcomes.length !== 0)
    raiseInvariant(
      "strikeDecisionsAndOutcomes",
      r.strikeDecisionsAndOutcomes,
      "EXPLICIT empty this slice (strike resolution deferred) — populated by the C-2 continuation",
    );
  if (!Array.isArray(r.standoffLevels))
    raiseInvariant("standoffLevels", r.standoffLevels, "must be an array");
  for (let i = 0; i < r.standoffLevels.length; i++) {
    const st = r.standoffLevels[i] as StandoffLevel | null | undefined;
    if (
      !st ||
      !isNonEmptyString(st.minePressureId) ||
      (st.level !== "none" &&
        st.level !== 1 &&
        st.level !== 2 &&
        st.level !== 3 &&
        st.level !== 4) ||
      (st.utilityMultiplierBp !== null && !isIntValue(st.utilityMultiplierBp))
    )
      raiseInvariant(`standoffLevels[${i}]`, st, "malformed §16 standoff level");
  }
  if (!Array.isArray(r.decay)) raiseInvariant("decay", r.decay, "must be an array");
  for (let i = 0; i < r.decay.length; i++) {
    const d = r.decay[i] as Record<string, unknown> | null | undefined;
    if (
      !d ||
      !isNonEmptyString(d.minePressureId) ||
      !isIntValue(d.retentionMultiplierBp) ||
      !isSafeMonth(d.decayedPressure) ||
      !isSafeMonth(d.pressureAfterDecay)
    )
      raiseInvariant(`decay[${i}]`, d, "malformed §21 decay entry");
  }
  if (!Array.isArray(r.postWarAndOwnershipDispositions))
    raiseInvariant(
      "postWarAndOwnershipDispositions",
      r.postWarAndOwnershipDispositions,
      "must be an array",
    );
  for (let i = 0; i < r.postWarAndOwnershipDispositions.length; i++) {
    const p = r.postWarAndOwnershipDispositions[i] as Record<string, unknown> | null | undefined;
    if (!p || !isNonEmptyString(p.minePressureId) || !isNonEmptyString(p.disposition))
      raiseInvariant(`postWarAndOwnershipDispositions[${i}]`, p, "malformed disposition");
  }
  if (!Array.isArray(r.reportsAndKnowledgeChanges))
    raiseInvariant("reportsAndKnowledgeChanges", r.reportsAndKnowledgeChanges, "must be an array");
  for (let i = 0; i < r.reportsAndKnowledgeChanges.length; i++) {
    const rc = r.reportsAndKnowledgeChanges[i] as Record<string, unknown> | null | undefined;
    if (!rc || !isNonEmptyString(rc.reportId) || !isNonEmptyString(rc.participantId))
      raiseInvariant(`reportsAndKnowledgeChanges[${i}]`, rc, "malformed report pair");
  }
  if (!Array.isArray(r.friendlyFireChecks) || r.friendlyFireChecks.length !== 0)
    raiseInvariant(
      "friendlyFireChecks",
      r.friendlyFireChecks,
      "EXPLICIT empty this slice (friendly-fire deferred) — populated by the C-2 continuation",
    );
  if (!Array.isArray(r.inventoryWarScorePoliticalAndDamageEffects))
    raiseInvariant(
      "inventoryWarScorePoliticalAndDamageEffects",
      r.inventoryWarScorePoliticalAndDamageEffects,
      "must be an array",
    );
  for (let i = 0; i < r.inventoryWarScorePoliticalAndDamageEffects.length; i++) {
    const e = r.inventoryWarScorePoliticalAndDamageEffects[i] as
      | Record<string, unknown>
      | null
      | undefined;
    if (
      !e ||
      !isIntValue(e.ordinal) ||
      !isNonEmptyString(e.stableId) ||
      !isNonEmptyString(e.description)
    )
      raiseInvariant(
        `inventoryWarScorePoliticalAndDamageEffects[${i}]`,
        e,
        "malformed effect entry",
      );
  }
  if (!Array.isArray(r.rngDecisions))
    raiseInvariant("rngDecisions", r.rngDecisions, "must be an array");
  for (let i = 0; i < r.rngDecisions.length; i++) {
    const d = r.rngDecisions[i] as RandomDecision | null | undefined;
    if (
      !d ||
      !isNonEmptyString(d.streamId) ||
      !isNonEmptyString(d.entityKey) ||
      !isNonEmptyString(d.outcome)
    )
      raiseInvariant(`rngDecisions[${i}]`, d, "malformed RNG decision");
  }
  if (r.rulesetVersion !== MINE_RULESET_VERSION || r.formulaVersion !== MINE_FORMULA_VERSION)
    raiseInvariant("versions", r, "must be the shipped mine ruleset/formula versions");
}

// assembler (consumes the INC-1..INC-7 surface in §29 canonical order)

export interface MineWarfareResolutionAssemblerInput {
  month: SafeInt;
  areaAndWarContexts: readonly AreaAndWarContext[];
  /** Opening pressure records (any order; sorted §29 level 3 inside). */
  openingPressureRecords: readonly AreaMinePressureRecord[];
  /** Laying sources + effective values (any order; sorted by source id inside). */
  layingSourcesAndValues: readonly LayingSourceAndValue[];
  /** Sweeping-ship modes + values (any order; sorted by ship id inside). */
  sweepingShipsModesValues: readonly SweepingShipModeValue[];
  /** Dual-equipment reductions emitted this month. */
  dualEquipmentReductions: readonly string[];
  /** §10 allocations (already in the §10 order; re-sorted defensively inside). */
  allocatedSweeping: readonly AllocatedSweeping[];
  /** Swept + decayed: total pressure removed in the coverage month. */
  pressureRemoved: SafeInt;
  /** Route probabilities (any order; sorted by route edge id inside). */
  routes: readonly RouteProbability[];
  /** EXPLICIT EMPTY — battle hazards deferred. */
  battle: readonly BattleProbability[];
  /** EXPLICIT EMPTY — strike decisions deferred. */
  strikeDecisionsAndOutcomes: readonly StrikeDecisionAndOutcome[];
  /** Standoff levels (any order). */
  standoffLevels: readonly StandoffLevel[];
  /** Decay (any order; sorted by mine pressure id inside). */
  decay: readonly DecayRecord[];
  /** Post-war/ownership dispositions (any order). */
  postWarAndOwnershipDispositions: readonly PostWarOwnershipDisposition[];
  /** Reports + knowledge-change pairs (any order). */
  reportsAndKnowledgeChanges: readonly ReportKnowledgeChange[];
  /** EXPLICIT EMPTY — friendly-fire checks deferred. */
  friendlyFireChecks: readonly FriendlyMineFireCheck[];
  /** §28 effects by declared §29 ordinal (sorted inside). */
  inventoryWarScorePoliticalAndDamageEffects: readonly MineWarfareEffect[];
  /** The RNG decisions recorded by this resolution (keyed streams only). */
  rngDecisions: readonly RandomDecision[];
}

export type SafeMonth = SafeInt;

/** AC-20: assemble ONE immutable §28 resolution record from the INC-1..INC-7
 *  pure-function outputs. Sort = §29 canonical order for every collection.
 *  The deferred collections (battle, strike, friendly-fire) MUST be empty —
 *  a non-empty value fails closed with MINE_WARFARE_INVARIANT_FAILED. */
export function assembleMineWarfareResolutionRecord(
  input: MineWarfareResolutionAssemblerInput,
): MineWarfareResolutionRecord {
  const body = buildMineWarfareResolutionBody(input);
  assertMineWarfareResolutionRecordSurface({
    ...body,
    recordHash: "",
  } as MineWarfareResolutionRecord);
  const recordHash = computeMineWarfareResolutionRecordHash(body);
  return deepFreeze({ ...body, recordHash });
}

function buildMineWarfareResolutionBody(
  input: MineWarfareResolutionAssemblerInput,
): MineWarfareResolutionRecordBody {
  const areaAndWarContexts = canonicallySorted(
    input.areaAndWarContexts.map((c) => ({
      areaId: c.areaId,
      // §29 item 1: wars by identifier INSIDE each area context — insertion
      // order must never leak into the record hash (the canonical sort below is
      // over areas, so without this the warIds array would stay in caller order).
      warIds: [...c.warIds].sort(compareMineStrings),
    })),
    (a, b) => compareAreasById({ areaId: a.areaId }, { areaId: b.areaId }),
  );
  const openingPressureRecords = canonicallySorted(
    input.openingPressureRecords.map((r) => ({ ...r })),
    compareMinePressureRecords,
  );
  const layingSourcesAndValues = canonicallySorted(
    input.layingSourcesAndValues.map((l) => ({ ...l })),
    (a, b) => compareLayingSourcesById({ source: a.source }, { source: b.source }),
  );
  const sweepingShipsModesValues = canonicallySorted(
    input.sweepingShipsModesValues.map((s) => ({ ...s })),
    (a, b) => compareSweepingShipsById({ shipId: a.shipId }, { shipId: b.shipId }),
  );
  // §29 item 6: sweep allocation by §10's five-key order (NOT minePressureId
  // alone — the §10 keys are materialized on each AllocatedSweeping by the
  // aggregation caller; the comparator is derived from sweepingAllocationOrder).
  const allocatedSweeping = canonicallySorted(
    input.allocatedSweeping.map((a) => ({ ...a })),
    compareAllocatedSweepingBySection10,
  );
  const routes = canonicallySorted(
    input.routes.map((r) => ({ ...r })),
    (a, b) =>
      compareRouteChecksByRouteEdgeId(
        { routeEdgeId: a.routeEdgeId },
        { routeEdgeId: b.routeEdgeId },
      ),
  );
  const standoffLevels = canonicallySorted(
    input.standoffLevels.map((s) => ({ ...s })),
    (a, b) => compareMineStrings(a.minePressureId, b.minePressureId),
  );
  const decay = canonicallySorted(
    input.decay.map((d) => ({ ...d })),
    (a, b) => compareMineStrings(a.minePressureId, b.minePressureId),
  );
  const postWarAndOwnershipDispositions = canonicallySorted(
    input.postWarAndOwnershipDispositions.map((p) => ({ ...p })),
    (a, b) => compareMineStrings(a.minePressureId, b.minePressureId),
  );
  const reportsAndKnowledgeChanges = canonicallySorted(
    input.reportsAndKnowledgeChanges.map((rc) => ({ ...rc })),
    (a, b) =>
      compareMineStrings(a.reportId, b.reportId) ||
      compareMineStrings(a.participantId, b.participantId),
  );
  const inventoryWarScorePoliticalAndDamageEffects = canonicallySorted(
    input.inventoryWarScorePoliticalAndDamageEffects.map((e) => ({ ...e })),
    (a, b) =>
      compareEffectsByDeclaredOrdinal(
        { ordinal: a.ordinal, stableId: a.stableId },
        { ordinal: b.ordinal, stableId: b.stableId },
      ),
  );
  const rngDecisions = canonicallySorted(
    input.rngDecisions.map((d) => ({ ...d })),
    (a, b) =>
      compareMineStrings(a.streamId, b.streamId) || compareMineStrings(a.entityKey, b.entityKey),
  );

  return {
    month: input.month,
    areaAndWarContexts,
    openingPressureRecords,
    layingSourcesAndValues,
    sweepingShipsModesValues,
    dualEquipmentReductions: [...input.dualEquipmentReductions].sort(compareMineStrings),
    allocatedSweeping,
    pressureRemoved: input.pressureRemoved,
    battleAndRouteProbabilities: { routes, battle: [...input.battle] },
    strikeDecisionsAndOutcomes: [...input.strikeDecisionsAndOutcomes],
    standoffLevels,
    decay,
    postWarAndOwnershipDispositions,
    reportsAndKnowledgeChanges,
    friendlyFireChecks: [...input.friendlyFireChecks],
    inventoryWarScorePoliticalAndDamageEffects,
    rngDecisions,
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  };
}

/** AC-20: the §28 authoritative record hash — domain-separated canonical
 *  envelope keyed to mine_warfare_resolution_v1, over the non-hash surface. */
export function computeMineWarfareResolutionRecordHash(
  body: MineWarfareResolutionRecordBody,
): string {
  return createEnvelope("mine_warfare_resolution", mineWarfareResolutionPolicyId, body).bodyHash;
}

/** AC-20: verify a record hash (recompute + compare; tamper fails). */
export function verifyMineWarfareResolutionRecordHash(r: MineWarfareResolutionRecord): boolean {
  const { recordHash: _ignored, ...body } = r;
  return computeMineWarfareResolutionRecordHash(body) === r.recordHash;
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

// The shipped §28 version enforcers (exported so no caller pins a divergent literal).
export const MINE_RESOLUTION_RULESET_VERSION = MINE_RULESET_VERSION;
export const MINE_RESOLUTION_FORMULA_VERSION = MINE_FORMULA_VERSION;
export const MINE_RESOLUTION_POLICY_ID = mineWarfareResolutionPolicyId;

// NOTE: the resolution record's DecayRecord shape is defined above (identical
// shape to the INC-7 decay results); decay.ts is not re-imported here — the
// C-2 continuation wires computeDecayedPressure results into this field.
