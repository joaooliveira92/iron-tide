// packages/combat/src/air-defense/radar-saturation.ts
// D-4 M4 Aviation: Air Defense — AC-9 radar-directed medium-AA group saturation per §13/§14.
//
// §13 "Radar-Directed Medium-AA Groups": a radar-directed medium-AA group is one
// independently targetable medium-AA group with ALL of: operational radar fire control; an
// assigned radar channel; an operational director; compatible ammunition; power; and a
// distinct engagement channel (§13 lines 224-235). A group lacking ANY predicate is counted
// as ORDINARY medium AA, not radar-directed (§13 line 235).
//
// §14 "Medium-AA Diminishing Returns": marginal effectiveness multipliers per radar-directed
// group: 1..4 → 10_000 bp each; 5..6 → 5_000; 7..8 → 2_500; 9+ → 500 (§14 lines 239-244).
//   effectiveRadarMediumAaGroups = sum(marginalGroupMultiplierBp) / 10_000
// The division is retained as an exact rational until the owning engagement formula rounds
// (§14 lines 246-250). INC-4 embeds that exact rational into §19's integer product
//   base × director × radar × crew × damage × ammunition × targetProfile × weather ×
//   saturation / 10_000^8
// by keeping the UNDIVIDED sum in the `radarBp` numerator slot: e.g. 4 radar-directed groups
// → radarBp = 40_000, which is the exact rational 4.0 (effectiveRadarMediumAaGroups = 4.0).
// NO per-group rounding happens at this layer — the owning formula rounds once (§19 line
// 326). §14 defines the schedule only for group counts ≥ 1; a ship with no radar-directed
// group has ordinary medium-AA engagements retaining the NEUTRAL radar factor 10_000 (the
// engagement-formula consumer-side neutral, not a §14 value).
//
// SLOT MAPPING (orchestrator-decided, INC-4): `radarBp` (the §19 `radarMultiplierBp` slot) ←
// this module (§14). `directorBp` ← director-scaling.ts (§12). `saturationBp` ←
// ciws-redundancy.ts (§16). crew/damage/ammunition stay INC-3 computed; targetProfile and
// weather are neutral-or-later concerns (INC-5/6). Engine call site wired in INC-6.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import { RADAR_SATURATION_TABLE, radarMediumAaMarginalMultiplierBp } from "./constants.js";
import type { LayerId } from "./air-defense-system-definition.js";
import {
  RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE,
  RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE,
} from "./reasonCodes.js";

/** The exact §14 effective-group/neutral boundary: with no radar-directed group (0), the
 *  consumer-side neutral radar factor 10_000 applies; §14 itself defines values only for
 *  group counts ≥ 1. */
export const RADAR_NEUTRAL_FACTOR_BP = 10_000 as const;

// ---- §13 classification predicate ----

export interface RadarDirectedMediumAaGroupPredicates {
  /** Defense layer — must be MEDIUM_AA for a radar-directed group (§13). */
  layer: LayerId;
  /** Operational radar fire control (§13 line 228). */
  radarFireControlOperational: boolean;
  /** An assigned radar channel for the group (§13 line 229). */
  radarChannelAssigned: boolean;
  /** An operational director (§13 line 230). */
  directorOperational: boolean;
  /** Compatible ammunition (§13 line 231). */
  ammunitionAvailable: boolean;
  /** Power (§13 line 232). */
  powerAvailable: boolean;
  /** A distinct engagement channel (§13 line 233). */
  distinctEngagementChannel: boolean;
}

/**
 * C: AC-9 (§13 lines 224-235) — true ONLY when the medium-AA group satisfies every §13
 * predicate. A group lacking any predicate is ordinary medium AA, not radar-directed.
 */
export function isRadarDirectedMediumAaGroup(
  predicates: RadarDirectedMediumAaGroupPredicates,
): boolean {
  return (
    predicates.layer === "MEDIUM_AA" &&
    predicates.radarFireControlOperational &&
    predicates.radarChannelAssigned &&
    predicates.directorOperational &&
    predicates.ammunitionAvailable &&
    predicates.powerAvailable &&
    predicates.distinctEngagementChannel
  );
}

// ---- §14 saturation factor ----

/**
 * C: AC-9 (§14) — the radar factor (the §19 `radarBp` slot) for a ship's radar-directed
 * medium-AA group count:
 *   count 0 → the NEUTRAL radar factor 10_000 (medium-AA engagements without radar
 *     direction retain the neutral; §14 defines only group counts ≥ 1);
 *   count ≥ 1 → Σ_{n=1..count} marginal(n) — the UNDIVIDED §14 sum, i.e. the exact rational
 *     effectiveRadarMediumAaGroups = Σ/10_000 kept in the numerator (see module comment).
 * The sum is computed exactly (small bounded loop over the 9 canonical schedule rows plus a
 * closed-form continuation for counts > 9, where every further marginal is the 9+ value 500)
 * with NO per-group rounding. Fail-closed: a negative or non-integer count throws
 * INVALID_AIR_DEFENSE_STATE.
 */
export function computeRadarFactorBp(radarDirectedGroupCount: number): SafeInt {
  if (!SafeInt.isSafeInt(radarDirectedGroupCount) || radarDirectedGroupCount < 0) {
    throw new BluewaveError(
      "computeRadarFactorBp: radarDirectedGroupCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, radarDirectedGroupCount },
    );
  }
  if (radarDirectedGroupCount === 0) {
    return SafeInt(RADAR_NEUTRAL_FACTOR_BP);
  }
  let sumBp = SafeInt.ZERO;
  const scheduleLength = RADAR_SATURATION_TABLE.length; // 9 — the last canonical schedule row
  const bounded = Math.min(radarDirectedGroupCount, scheduleLength);
  for (let n = 1; n <= bounded; n++) {
    sumBp = SafeInt.add(sumBp, SafeInt(radarMediumAaMarginalMultiplierBp(n)));
  }
  if (radarDirectedGroupCount > bounded) {
    // Groups 9+ each contribute exactly the 9+ marginal (500) — closed form, no loop. The
    // SafeInt multiply/add keeps the closed-form continuation overflow-checked exactly like
    // the loop: a count so large the aggregate would overflow is rejected fail-closed
    // (LOW-5 repair).
    sumBp = SafeInt.add(
      sumBp,
      SafeInt.mul(
        SafeInt(radarDirectedGroupCount - bounded),
        SafeInt(radarMediumAaMarginalMultiplierBp(bounded)),
      ),
    );
  }
  return sumBp;
}

/**
 * §28 markers accompanying the §14 factor: count 5..8 →
 * [RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE]; count ≥ 9 →
 * [RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE]; otherwise none. The full §28 code rollup lands
 * in INC-5.
 */
export function radarSaturationMarkers(radarDirectedGroupCount: number): ReadonlyArray<string> {
  if (!SafeInt.isSafeInt(radarDirectedGroupCount) || radarDirectedGroupCount < 0) {
    throw new BluewaveError(
      "radarSaturationMarkers: radarDirectedGroupCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, radarDirectedGroupCount },
    );
  }
  if (radarDirectedGroupCount >= 9) {
    return [RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE];
  }
  if (radarDirectedGroupCount >= 5) {
    return [RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE];
  }
  return [];
}
