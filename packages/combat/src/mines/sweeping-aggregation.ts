//packages/combat/src/mines/sweeping-aggregation.ts
// DESIGN-35 §10 regional sweeping aggregation + allocation (INC-4).
//
// Regional sweeping value (§10): the SUM of effective eligible-ship values
// (INC-3's computeEffectiveSweepingValue) TAKEN IN ASCENDING SHIP-IDENTIFIER
// ORDER — never the caller's incidental array/iteration order. An ineligible
// ship (INC-3's minesweepingShipEligible) contributes ZERO
// (INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION) and is surfaced in `ineligible` so
// the caller can emit MINESWEEPING_SHIP_INELIGIBLE for the aggregate; it is
// NEVER summed.
//
// Per mine-pressure record (§10):
//   typeAdjustedSweeping   = floor(regionalSweepingValue * resistanceBp / 10_000)
//   sweptPressure          = min(currentPressure, typeAdjustedSweeping)
//   pressureAfterSweeping  = currentPressure - sweptPressure     (never below zero)
// with mineTypeSweepResistanceMultiplierBp resolved from the shipped
// MineTypeDefinition.sweepResistance surface (effective-sweeping.ts reuse).
//
// Allocation is a BUDGET over the shared regional value consumed across records
// in EXACTLY §10's order:
//   1. controlled-defensive mines threatening the sweeping side (first);
//   2. highest current strike risk;
//   3. highest pressure;
//   4. mine-type identifier;
//   5. mine-pressure identifier.
// sweepingAllocationOrder(a, b) is the canonical five-key comparator (explicit
// typed sort keys, NEVER incidental JS insertion/object-key order — the same
// deterministic-sort discipline as packages/combat/src/damage/ordering.ts).
// allocateSweeping sorts the candidates with that comparator and then consumes
// the folded budget sequentially: each record's typeAdjustedSweeping is computed
// from the REMAINING budget, only the actually-swept pressure is deducted, and
// the unabsorbed (unreduced) portion passes on to the next record. Exactly ONE
// allocation is emitted per record — a record never receives the full regional
// value on top of another record receiving it too.
//
// STRIKE-RISK SEAM (wired by INC-5): §13 route-risk (route-risk.ts) now ships the
// real `computeRouteRiskBp` VALUE. Its `routeRiskBp` (0..10_000) is exactly the
// "highest current strike risk = earlier" key-2 priority: routeRiskBpToAllocationPriority
// (route-risk.ts) maps it order-preservingly, so the §13 value ties into this
// accessor as `recordRiskPriority: (record) =>
//   routeRiskBpToAllocationPriority(computeRouteRiskBp(record.pressure, ...).routeRiskBp)`.
// THE COMPARATOR CONTRACT IS UNCHANGED (§10 key 2 already names "highest risk
// first" structurally) and INC-4's DEFAULT_STRIKE_RISK_PRIORITY remains the
// production default today — INC-5 DOES NOT alter INC-4's comparator or default.
// The actual per-record call-site (computing routeRisk per record in the sweep
// allocation loop) belongs to INC-8's records/ordering assembler, which wires the
// live §13 value into this accessor. No route-risk value is fabricated here, and
// DISCLAIMER: a routeRiskBp does NOT auto-deny movement (DESIGN-25 blocks §14–15
// route-strike consumption; blocked on ticket 03).
//
// CLEARANCE SEAM (vs INC-7): applySweptPressure reduces pressure and recomputes
// the record hash. When a record is swept to pressure 0 it is the CLEARED
// boundary — but full clearance/removal semantics (knowledge updates,
// MINEFIELD_CLEARED, apportion-vs-delete) are INC-7's scope (§27). This
// increment KEEPS the reduction + hash of the zero-pressure transitional state
// and does NOT delete the record; the caller hands that state to INC-7's
// clearance for closure. applySweptPressure never removes a record.
//
// Pure/deterministic: no I/O/clock/random; fixed integer semantics only.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { type MineType } from "./constants.js";
import { effectiveEquipmentModeMultiplierBp, resolveDualEquipmentMode } from "./dual-equipment.js";
import {
  computeEffectiveSweepingValue,
  computeTypeAdjustedSweeping,
  mineTypeSweepResistanceMultiplierBp,
} from "./effective-sweeping.js";
import { mineTypeDefinitionById } from "./model.js";
import {
  computeAreaPressureRecordHash,
  MINE_PRESSURE_MIN,
  type AreaMinePressureRecord,
  withAreaMinePressureRecordHash,
} from "./pressure-record.js";
import {
  INVALID_MINE_PRESSURE_STATE,
  MINE_PRESSURE_REDUCED,
  type MineReasonCode,
} from "./reasonCodes.js";
import { baseSweepingValueById, type SweepingBaseValueKey } from "./sweeping-base-values.js";
import {
  INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION,
  minesweepingShipEligible,
  type MinesweepingEligibilityPredicate,
  type MinesweepingShip,
} from "./sweeping-eligibility.js";

// ---------------------------------------------------------------------------
// §10 aggregation
// ---------------------------------------------------------------------------

// The complete input surface a single ship needs for regional aggregation: the
// INC-3 eligibility surface + the §7 base-value key + the §8 dual-equipment
// resolution inputs + the §9 five non-equipment multipliers (the equipment-mode
// multiplier is DERIVED from the dual-equipment resolution, never passed raw so
// a ship cannot receive full sweeping value accidentally).
export interface RegionalSweepingShip {
  /** Mirrors the eligibility surface's shipId (the §10 ascending-sort key). */
  shipId: string;
  /** §6 eligibility surface — run through minesweepingShipEligible first. */
  eligibility: MinesweepingShip;
  /** §7 shipped base-value key (fail-closed lookup via baseSweepingValueById). */
  baseValueKey: SweepingBaseValueKey;
  /** §8 dual-purpose declaration + locked mode command (or null). */
  equipmentIsDualPurpose: boolean;
  lockedMissionOrEquipmentCommand: string | null;
  /** §9 the five non-equipment multipliers (tech/crew/readiness/damage/support). */
  technologyMultiplierBp: number;
  crewMultiplierBp: number;
  readinessMultiplierBp: number;
  damageMultiplierBp: number;
  supportMultiplierBp: number;
}

/** An eligible ship's regional contribution, keyed by ascending shipId. */
export interface RegionalSweepingContribution {
  shipId: string;
  effectiveSweepingValue: SafeInt;
}

/** An ineligible ship's diagnostic for the aggregate MINESWEEPING_SHIP_INELIGIBLE emit. */
export interface IneligibleSweepingShip {
  ship: MinesweepingShip;
  reason: string;
  failingPredicate: MinesweepingEligibilityPredicate | null;
}

export interface RegionalSweepingValueResult {
  /** Sum of effective eligible-ship values in ASCENDING ship-identifier order. */
  regionalSweepingValue: SafeInt;
  /** Eligible contributions, sorted by shipId ascending (§10 canonical order). */
  over: readonly RegionalSweepingContribution[];
  /** Ineligible ships (ZERO contribution) — the caller emits MINESWEEPING_SHIP_INELIGIBLE for the aggregate. */
  ineligible: readonly IneligibleSweepingShip[];
}

// Canonical absence-of-locale comparator: plain UTF-16 code-unit comparison.
// The no-locale-read determinism contract (ENGINEERING-CONTRACT §Determinism,
// DESIGN-35 §29) forbids localeCompare in authoritative ordering — host/ICU
// collation varies by OS and locale, and ties hand order back to the input
// array. Never relies on incidental array/iteration order.
export function compareMineId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sweepingContributionOrder(
  a: RegionalSweepingContribution,
  b: RegionalSweepingContribution,
): number {
  return compareMineId(a.shipId, b.shipId);
}

// AC-10: assemble an eligible ship's full §9 effective value from its §7 base
// value, §8 resolved equipment-mode multiplier, and §9 five non-equipment
// multipliers. A single FLOOR, exact rational — delegated to
// computeEffectiveSweepingValue (INC-3).
export function effectiveSweepingValueForShip(input: RegionalSweepingShip): SafeInt {
  const baseSweepingValue = baseSweepingValueById(input.baseValueKey);
  const mode = resolveDualEquipmentMode(
    input.equipmentIsDualPurpose,
    input.lockedMissionOrEquipmentCommand,
  );
  const resolution = computeEffectiveSweepingValue(baseSweepingValue, {
    equipmentModeMultiplierBp: effectiveEquipmentModeMultiplierBp(mode),
    technologyMultiplierBp: input.technologyMultiplierBp,
    crewMultiplierBp: input.crewMultiplierBp,
    readinessMultiplierBp: input.readinessMultiplierBp,
    damageMultiplierBp: input.damageMultiplierBp,
    supportMultiplierBp: input.supportMultiplierBp,
  });
  return resolution.effectiveSweepingValue;
}

// AC-10: regional sweeping value = sum of effective eligible-ship values in
// ASCENDING ship-id order. Each ship is first run through minesweepingShipEligible;
// an ineligible ship contributes ZERO (INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION),
// is never summed, and is returned in `ineligible` so the caller can emit
// MINESWEEPING_SHIP_INELIGIBLE for the aggregate. Feeding the ships in any
// incidental order yields the SAME regional value + the SAME sorted contribution
// list (order-independence is proven in the test by shuffling input).
export function computeRegionalSweepingValue(
  ships: readonly RegionalSweepingShip[],
): RegionalSweepingValueResult {
  const over: RegionalSweepingContribution[] = [];
  const ineligible: IneligibleSweepingShip[] = [];

  for (const input of ships) {
    const verdict = minesweepingShipEligible(input.eligibility);
    if (!verdict.eligible) {
      // §6: an ineligible ship contributes zero — never summed.
      void INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION;
      ineligible.push({
        ship: input.eligibility,
        reason: verdict.reason,
        failingPredicate: verdict.verdict.failingPredicate,
      });
      continue;
    }
    over.push({
      shipId: input.shipId,
      effectiveSweepingValue: effectiveSweepingValueForShip(input),
    });
  }

  // Deterministic: sort contributions ascending by shipId (§29 sweeping ships by
  // ship identifier), then fold the sum in that exact order.
  const sorted = [...over].sort(sweepingContributionOrder);
  let regionalSweepingValue = SafeInt.ZERO;
  for (const contribution of sorted) {
    regionalSweepingValue = SafeInt.add(regionalSweepingValue, contribution.effectiveSweepingValue);
  }

  return { regionalSweepingValue, over: sorted, ineligible };
}

// ---------------------------------------------------------------------------
// §10 allocation
// ---------------------------------------------------------------------------

// A record plus the pre-computed keys the five-part §10 comparator needs. The
// candidate materializes the sort keys EXACTLY once (never recomputed during the
// sort), keeping the comparator total/deterministic.
export interface SweepingAllocationCandidate {
  record: AreaMinePressureRecord;
  /** Whether this record's mines threaten the sweeping side (§10 key 1). */
  threatensSweepingSide: boolean;
  /** Current strike-risk priority (higher = higher risk = earlier, §10 key 2). */
  strikeRiskPriority: number;
  /** §9 resistance multiplier for this record's mine type. */
  resistanceMultiplierBp: number;
}

// AC-10: canonical §10 comparator over the FIVE keys:
//   1. controlled-defensive threat (threatening the sweeping side sorts FIRST);
//   2. highest current strike risk (higher priority sorts first, DESC);
//   3. highest pressure (DESC);
//   4. mine-type identifier (ASC, codepoint; no localeCompare — no-locale contract);
//   5. mine-pressure identifier (ASC, codepoint; no localeCompare).
// Explicit typed sort keys — never incidental JS object-key/insertion order.
// `a` before `b` when the comparator returns negative (Array#sort semantics).
export function sweepingAllocationOrder(
  a: SweepingAllocationCandidate,
  b: SweepingAllocationCandidate,
): number {
  // Key 1: threatening-the-sweeper records (true) sort before non-threatening.
  const threatA = a.threatensSweepingSide ? 1 : 0;
  const threatB = b.threatensSweepingSide ? 1 : 0;
  return (
    threatB - threatA ||
    b.strikeRiskPriority - a.strikeRiskPriority ||
    Number(b.record.pressure) - Number(a.record.pressure) ||
    compareMineId(a.record.mineTypeId, b.record.mineTypeId) ||
    compareMineId(a.record.minePressureId, b.record.minePressureId)
  );
}

// §10 key 2 default when the caller supplies no per-record strike-risk accessor:
// every record defaults to the SAME HIGHEST priority so ordering falls through
// deterministically to key 3 (pressure). Documented — never fabricated from a
// not-yet-shipped route-risk value (INC-5 wires the real one via the accessor).
export const DEFAULT_STRIKE_RISK_PRIORITY: number = Number.MAX_SAFE_INTEGER;

export interface SweepingAllocationOptions {
  /** Id of the belligerent side performing the sweep — derives §10 key 1 (controlled-defensive mines targeting THIS side threaten it). */
  sweepingBelligerentId: string;
  /** Per-record sweep-capability check (e.g. magnetic-sweep for MAGNETIC) used to resolve the §9 resistance multiplier. */
  hasMatchingSweepCapability: (record: AreaMinePressureRecord) => boolean;
  /** §10 key 2 accessor: higher number = higher current strike risk = earlier. Defaults to DEFAULT_STRIKE_RISK_PRIORITY (documented seam, INC-5 wires the real §13 value). */
  recordRiskPriority?: (record: AreaMinePressureRecord) => number;
}

// Per-record allocation result, emitted exactly once per record (a record never
// receives the full regional value alongside another record receiving it too).
export interface SweepingAllocationResultItem {
  recordId: string;
  mineTypeId: MineType;
  /** floor(remainingRegional * resistanceBp / 10_000) for THIS record. */
  typeAdjustedSweeping: SafeInt;
  /** min(currentPressure, typeAdjustedSweeping) — the pressure actually removed. */
  sweptPressure: SafeInt;
  /** currentPressure - sweptPressure, NEVER below zero. */
  pressureAfter: SafeInt;
  /** The portion of THIS record's type-adjusted value NOT absorbed (current pressure was the cap) — it passes on to the next record. */
  unreducedAllocation: SafeInt;
  /** MINE_PRESSURE_REDUCED when sweptPressure > 0; null otherwise (emitted reduction event). */
  pressureReducedCode: MineReasonCode | null;
}

export interface SweepingAllocationResult {
  /** One allocation per record, in §10 allocation order (never input order). */
  allocations: readonly SweepingAllocationResultItem[];
  /** The regional value left after sequentially consuming swept pressure. */
  leftoverUnusedValue: SafeInt;
}

// AC-10: allocate the shared regional sweeping budget across the records in
// §10's canonical order. Builds candidates (materializing the five sort keys +
// §9 resistance), sorts with sweepingAllocationOrder (never input order), then
// folds the budget: each record's typeAdjustedSweeping is computed from the
// REMAINING budget, only the swept pressure is deducted, and the unreduced
// portion passes on to the next record. Emits MINE_PRESSURE_REDUCED per record
// whose sweptPressure > 0. A record whose pressure reaches 0 is followed through
// the reduction but NEVER deleted here (INC-7 owns clearance).
export function allocateSweeping(
  regionalValue: SafeInt,
  records: readonly AreaMinePressureRecord[],
  opts: SweepingAllocationOptions,
): SweepingAllocationResult {
  if (!SafeInt.isSafeInt(regionalValue) || regionalValue < 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "regionalValue",
      reason: "regional sweeping value must be a non-negative integer (§10)",
      value: regionalValue,
    });

  const riskPriority = opts.recordRiskPriority ?? (() => DEFAULT_STRIKE_RISK_PRIORITY);

  const candidates: SweepingAllocationCandidate[] = records.map((record) => {
    const definition = mineTypeDefinitionById(record.mineTypeId);
    const resistanceMultiplierBp = mineTypeSweepResistanceMultiplierBp(
      definition,
      opts.hasMatchingSweepCapability(record),
    );
    // §10 key 1: a CONTROLLED_DEFENSIVE record whose targets include the sweeping
    // side threatens it -> sorts first. Non-controlled records never threaten.
    const threatensSweepingSide =
      record.mineTypeId === "CONTROLLED_DEFENSIVE" &&
      record.targetBelligerents.includes(opts.sweepingBelligerentId);
    return {
      record,
      threatensSweepingSide,
      strikeRiskPriority: riskPriority(record),
      resistanceMultiplierBp,
    };
  });
  candidates.sort(sweepingAllocationOrder);

  let remainingBudget = regionalValue;
  const allocations: SweepingAllocationResultItem[] = [];
  for (const candidate of candidates) {
    const { record } = candidate;
    const typeAdjustedSweeping = computeTypeAdjustedSweeping(
      remainingBudget,
      candidate.resistanceMultiplierBp,
    );
    // sweptPressure = min(currentPressure, typeAdjustedSweeping); branded integers.
    const sweptPressure = SafeInt(Math.min(Number(record.pressure), Number(typeAdjustedSweeping)));
    if (sweptPressure < 0 || sweptPressure > record.pressure)
      throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
        code: INVALID_MINE_PRESSURE_STATE,
        field: "sweptPressure",
        reason: "swept pressure must be within 0..currentPressure (§10, never below zero)",
        value: { currentPressure: record.pressure, sweptPressure },
      });
    const pressureAfter = SafeInt.sub(record.pressure, sweptPressure);
    // The unabsorbed type-adjusted amount passes to the next record.
    const unreducedAllocation = SafeInt.sub(typeAdjustedSweeping, sweptPressure);

    // Only the actually-swept pressure is deducted from the shared budget.
    remainingBudget = SafeInt.sub(remainingBudget, sweptPressure);

    allocations.push({
      recordId: record.minePressureId,
      mineTypeId: record.mineTypeId,
      typeAdjustedSweeping,
      sweptPressure,
      pressureAfter,
      unreducedAllocation,
      pressureReducedCode: sweptPressure > 0 ? MINE_PRESSURE_REDUCED : null,
    });
  }

  return { allocations, leftoverUnusedValue: remainingBudget };
}

// ---------------------------------------------------------------------------
// §10 swept-pressure update on the record
// ---------------------------------------------------------------------------

// AC-10: apply a swept pressure to an AreaMinePressureRecord: pressureAfter =
// pressure - sweptPressure (>= 0, never below zero), lastSweptMonth set to
// campaignMonth, recordHash recomputed via withAreaMinePressureRecordHash.
//
// CLEARANCE SEAM (documented vs INC-7): when pressureAfter reaches 0 the record
// is at the §1 CLEARED boundary (zero pressure = absence of an active record),
// so it can no longer pass the active-surface validation that
// withAreaMinePressureRecordHash enforces (pressure must be >= 1). This
// increment KEEPS the reduction + hash of that zero-pressure transitional record
// (hash computed deterministically via computeAreaPressureRecordHash) and DOES
// NOT delete it. Full clearance/removal semantics — knowledge updates,
// MINEFIELD_CLEARED, apportion-vs-delete — are INC-7's scope (§27). The caller
// must hand this zero-pressure state to INC-7's clearance rather than persisting
// it as an active record.
export function applySweptPressure(
  record: AreaMinePressureRecord,
  sweptPressure: SafeInt,
  campaignMonth: SafeInt,
): AreaMinePressureRecord {
  if (!SafeInt.isSafeInt(sweptPressure) || sweptPressure < 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "sweptPressure",
      reason: "swept pressure must be a non-negative integer (§10)",
      value: sweptPressure,
    });
  if (sweptPressure > record.pressure)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "sweptPressure",
      reason: "swept pressure exceeds current pressure — sweeping never reduces below zero (§10)",
      value: { currentPressure: record.pressure, sweptPressure },
    });
  if (!SafeInt.isSafeInt(campaignMonth))
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "campaignMonth",
      reason: "campaign month must be a safe integer (§10)",
      value: campaignMonth,
    });

  const pressureAfter = SafeInt.sub(record.pressure, sweptPressure);
  const reduced: Omit<AreaMinePressureRecord, "recordHash"> = {
    ...record,
    pressure: pressureAfter,
    lastSweptMonth: campaignMonth,
  };

  if (pressureAfter >= MINE_PRESSURE_MIN) {
    // Still an active record -> full validation + hash.
    return withAreaMinePressureRecordHash(reduced);
  }
  // pressureAfter === 0: the §1 cleared boundary. Keep the reduction + a
  // deterministic hash of the transitional zero state; do NOT delete (INC-7).
  return {
    ...reduced,
    recordHash: computeAreaPressureRecordHash(reduced as AreaMinePressureRecord),
  };
}
