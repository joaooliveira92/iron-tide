// DESIGN-35 §29 — canonical mine-warfare resolution ordering (INC-8, AC-20).
// Mine-warfare resolution MUST order:
//
//   1. wars by identifier;
//   2. areas by identifier;
//   3. mine-pressure records by laying participant, mine type, and record id;
//   4. laying sources by source identifier;
//   5. sweeping ships by ship identifier;
//   6. sweep allocation by Section 10 (the computeRegionalSweepingValue /
//      allocateSweeping fold, whose contribution/allocation order is already
//      canonical in sweeping-aggregation.ts);
//   7. route and battle checks by target identifier;
//   8. friendly-fire checks by ship identifier (DEFERRED this slice — C-2
//      continuation owns strike machinery; no record exists, comparator shipped
//      for the stable field);
//   9. effects by declared effect ordinal.
//
// Database insertion order, localized strings, UI order, and wall-clock time
// MUST NOT affect outcomes (DESIGN-35 §29). The records module therefore sorts
// EVERY collection it assembles with the comparators in this module. Plain
// UTF-16 code-unit comparison only — NEVER localeCompare (the no-locale-read
// determinism contract; locale/ICU collation varies by OS).
import { type AreaMinePressureRecord } from "./pressure-record.js";
import { SafeInt } from "@bluewave/contracts";
import {
  type SweepingAllocationCandidate,
  compareMineId,
  sweepingAllocationOrder,
  sweepingContributionOrder,
  type RegionalSweepingContribution,
} from "./sweeping-aggregation.js";

/** Plain deterministic code-unit string compare (no locale, no OS dependence).
 *  THE canonical string comparator for this subsystem (§29 forbids localeCompare). */
export function compareMineStrings(a: string, b: string): number {
  return compareMineId(a, b);
}

/** Level 1: wars by identifier. */
export function compareWarsById(a: { warId: string }, b: { warId: string }): number {
  return compareMineStrings(a.warId, b.warId);
}

/** Level 2: areas by identifier. */
export function compareAreasById(a: { areaId: string }, b: { areaId: string }): number {
  return compareMineStrings(a.areaId, b.areaId);
}

/** Level 3: mine-pressure records by laying participant, mine type, then record id. */
export function compareMinePressureRecords(
  a: Pick<AreaMinePressureRecord, "layingParticipantId" | "mineTypeId" | "minePressureId">,
  b: Pick<AreaMinePressureRecord, "layingParticipantId" | "mineTypeId" | "minePressureId">,
): number {
  return (
    compareMineStrings(a.layingParticipantId, b.layingParticipantId) ||
    compareMineStrings(a.mineTypeId, b.mineTypeId) ||
    compareMineStrings(a.minePressureId, b.minePressureId)
  );
}

/** Level 4: laying sources by source identifier. */
export function compareLayingSourcesById(a: { source: string }, b: { source: string }): number {
  return compareMineStrings(a.source, b.source);
}

/** Level 5: sweeping ships by ship identifier. */
export function compareSweepingShipsById(a: { shipId: string }, b: { shipId: string }): number {
  return compareMineStrings(a.shipId, b.shipId);
}

// Level 6: sweep allocation by Section 10. The canonical contribution /
// allocation ORDER is owned by sweeping-aggregation.ts (their comparators run
// on ascending ship id for contributions and the five-key §10 order for
// allocation candidates). We DELEGATE here (§29 item 6) rather than re-derive,
// so the records collation can never diverge from the aggregation itself.
export { sweepingContributionOrder, sweepingAllocationOrder };

/** Convert a regional contribution into the §29 allocations a record consumes
 *  (the contribution list IS the §10 ordered surface). */
export function contributionToAllocationOrder(
  a: RegionalSweepingContribution,
  b: RegionalSweepingContribution,
): number {
  return sweepingContributionOrder(a, b);
}

/** §10 five-key allocation comparator over candidates (re-exported alias). */
export function compareSweepAllocation(
  a: SweepingAllocationCandidate,
  b: SweepingAllocationCandidate,
): number {
  return sweepingAllocationOrder(a, b);
}

/** Level 6 (§29 item 6): §10 five-key allocation order over the RECORD surface.
 *  §10 keys: (1) controlled-defensive threat DESC, (2) strike risk DESC,
 *  (3) current pressure DESC, (4) mine type id ASC, (5) mine-pressure id ASC.
 *  `pressure` is recovered as sweptPressure + pressureAfter (the §10 reduction
 *  carried exactly); the threat/risk/type keys are those materialized by the
 *  aggregation. Codepoint compare only — never localeCompare. The structural
 *  key type (rather than importing AllocatedSweeping from records.js) avoids a
 *  module cycle: records.js already imports ordering.js. */
export interface AllocatedSweepingSortKey {
  minePressureId: string;
  sweptPressure: SafeInt;
  pressureAfter: SafeInt;
  mineTypeId: string;
  threatensSweepingSide: boolean;
  strikeRiskPriority: number;
}

export function compareAllocatedSweepingBySection10(
  a: Pick<
    AllocatedSweepingSortKey,
    | "minePressureId"
    | "sweptPressure"
    | "pressureAfter"
    | "mineTypeId"
    | "threatensSweepingSide"
    | "strikeRiskPriority"
  >,
  b: Pick<
    AllocatedSweepingSortKey,
    | "minePressureId"
    | "sweptPressure"
    | "pressureAfter"
    | "mineTypeId"
    | "threatensSweepingSide"
    | "strikeRiskPriority"
  >,
): number {
  const threatA = a.threatensSweepingSide ? 1 : 0;
  const threatB = b.threatensSweepingSide ? 1 : 0;
  const pressureA = Number(a.sweptPressure) + Number(a.pressureAfter);
  const pressureB = Number(b.sweptPressure) + Number(b.pressureAfter);
  return (
    threatB - threatA ||
    b.strikeRiskPriority - a.strikeRiskPriority ||
    pressureB - pressureA ||
    compareMineStrings(a.mineTypeId, b.mineTypeId) ||
    compareMineStrings(a.minePressureId, b.minePressureId)
  );
}

/** Level 7: route/battle checks by target identifier (route edge id / battle
 *  hazard target id). Battle checks are DEFERRED this slice; the comparator is
 *  shipped so the stable field has a deterministic order. */
export function compareTargetChecksById(a: { targetId: string }, b: { targetId: string }): number {
  return compareMineStrings(a.targetId, b.targetId);
}

/** Level 7 helper: route-probability checks by their route edge id. */
export function compareRouteChecksByRouteEdgeId(
  a: { routeEdgeId: string },
  b: { routeEdgeId: string },
): number {
  return compareMineStrings(a.routeEdgeId, b.routeEdgeId);
}

/** Level 8: friendly-fire checks by ship identifier (DEFERRED — no check is
 *  emitted this slice, but the stable field must order deterministically). */
export function compareFriendlyFireChecksByShipId(
  a: { shipId: string },
  b: { shipId: string },
): number {
  return compareMineStrings(a.shipId, b.shipId);
}

/** Level 9: effects by declared effect ordinal (then by a stable id tiebreak so
 *  two effects of the same declared ordinal are never order-garbled). */
export function compareEffectsByDeclaredOrdinal(
  a: { ordinal: number; stableId: string },
  b: { ordinal: number; stableId: string },
): number {
  return a.ordinal - b.ordinal || compareMineStrings(a.stableId, b.stableId);
}

/** Collation helper: sort a copy of an input array with a comparator. Returns a
 *  NEW sorted array; never mutates the input. */
export function canonicallySorted<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare);
}
