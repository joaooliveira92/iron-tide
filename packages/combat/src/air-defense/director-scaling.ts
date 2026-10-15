// D-4 M4 Aviation: Air Defense — AC-8 AA director assignment + scaling per DESIGN-45 §11/§12.
//
// §11 "AA Director Assignment": directors MUST be assigned before firing by
//   1. defense layer priority; 2. threat score descending; 3. time to impact ascending;
//   4. target identifier ascending; 5. director identifier ascending (§11 lines 198-204).
// An AA director may control exactly one engagement channel (§11 line 196 == §1 line 22),
// and one director MUST NOT provide its full modifier to two simultaneous groups (§11 line
// 206) — implemented here by allocating each sorted engagement exactly one operational
// director and never reusing a director within one assignment pass.
//
// §11.2 "threat score descending": DESIGN-45 defines no threat-score formula. The ONLY
// canonical threat ordering in the document is §17 Simultaneous Threats; the orchestrator
// has RESOLVED (D-4 ticket 04) that "threat score descending" is realized deterministically
// from §17, expressed as a comparator where "higher = assigned first", with these keys:
//   (1) released threats first                    (§17.1) — attack.isReleased
//   (2) closer to impact first                    (§17 "closest to impact", §17.6) — smaller
//       timeToImpactMs
//   (3) threats against the defended ship before threats against protected nearby ships
//       (§17.3-4) — attack.targetId === defenderId
//   (4) expected-damage proxy DESCENDING          (§17.5) — larger formationSize (the attack's
//       declared deterministic fields; no RNG)
//   (5) target identifier ASCENDING               (§17.7)
// This comparator IS the resolved threat score — no other formula is invented here.
//
// §12 "AA Director Scaling": directorBp (the §19 `directorMultiplierBp` slot) ←
// computeDirectorFactorBp(operationalDirectorCount): 0→5_000, 1→10_000, 2→18_000,
// 3→25_000, 4→31_000; 5+ stays 31_000 (no additional directed-fire value; marker
// AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED). Permitted normal-scaling cap 2..6; shipped cap
// exactly 4 (§12 line 222).
//
// SLOT MAPPING (orchestrator-decided, INC-4): in the §19 nine-factor product
//   base × director × radar × crew × damage × ammunition × targetProfile × weather ×
//   saturation / 10_000^8
// `directorBp` ← this module (§12). `radarBp` ← radar-saturation.ts (§14).
// `saturationBp` ← ciws-redundancy.ts (§16). crew/damage/ammunition stay INC-3 computed
// (resolveEngagement derives damage+ammunition from authoritative state). targetProfile and
// weather are neutral-or-later concerns (INC-5/6). The engine call site is wired in INC-6.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import { DIRECTOR_SCALING_TABLE } from "./constants.js";
import type { AirDefenseSystemDefinition, LayerId } from "./air-defense-system-definition.js";
import { isValidLayer } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseOperability } from "./eligibility.js";
import { isSystemOperable } from "./eligibility.js";
import { DEFENSE_LAYER_ORDER } from "./layer-resolution.js";
import {
  AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
} from "./reasonCodes.js";

// ---- §12 director scaling ----

/**
 * §12 shipped normal-scaling cap: the highest director count contributing aggregate
 * directed-fire value. The permitted cap range is 2..6 and the shipped cap is exactly 4
 * (§12 line 222), matching the last row of DIRECTOR_SCALING_TABLE.
 */
export const DIRECTOR_NORMAL_SCALING_CAP =
  DIRECTOR_SCALING_TABLE[DIRECTOR_SCALING_TABLE.length - 1]![0];

/**
 * B: AC-8 (§12 lines 210-222) — aggregate directed-fire value for the number of OPERATIONAL
 * directors on one defended ship: 0→5_000, 1→10_000, 2→18_000, 3→25_000, 4→31_000, and
 * count ≥ 4 (shipped cap) stays 31_000 — directors above the fourth contribute no
 * additional directed-fire value under the shipped policy (§12 line 220). The count is
 * derived from the ship's operational directors (assignAADirectors). Fail-closed: a
 * negative or non-integer count throws INVALID_AIR_DEFENSE_STATE.
 */
export function computeDirectorFactorBp(operationalDirectorCount: number): SafeInt {
  if (!SafeInt.isSafeInt(operationalDirectorCount) || operationalDirectorCount < 0) {
    throw new BluewaveError(
      "computeDirectorFactorBp: operationalDirectorCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, operationalDirectorCount },
    );
  }
  if (operationalDirectorCount >= DIRECTOR_NORMAL_SCALING_CAP) {
    return SafeInt(DIRECTOR_SCALING_TABLE[DIRECTOR_SCALING_TABLE.length - 1]![1]);
  }
  return SafeInt(DIRECTOR_SCALING_TABLE[operationalDirectorCount]![1]);
}

/**
 * §28 markers accompanying the §12 scaling result. Count > shipped cap (≥ 5) →
 * [AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED]; at or below the cap → no marker. The full §28
 * code rollup lands in INC-5.
 */
export function directorScalingMarkers(operationalDirectorCount: number): ReadonlyArray<string> {
  if (!SafeInt.isSafeInt(operationalDirectorCount) || operationalDirectorCount < 0) {
    throw new BluewaveError(
      "directorScalingMarkers: operationalDirectorCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, operationalDirectorCount },
    );
  }
  if (operationalDirectorCount > DIRECTOR_NORMAL_SCALING_CAP) {
    return [AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED];
  }
  return [];
}

// ---- §17-based threat comparator (§11.2) ----

/**
 * A: §17-based threat priority comparator (the resolved §11.2 "threat score descending").
 * Returns a negative value when `a` ranks FIRST (is the higher threat and is assigned first),
 * positive when `b` first, 0 when tied on every key. Keys in order — see module comment:
 *   1. released threats first; 2. closer to impact first; 3. defended ship first;
 *   4. expected-damage proxy (formationSize) descending; 5. target identifier ascending.
 * String keys use codepoint `<` / `>` comparisons only — never localeCompare (determinism
 * contract). Pure: no randomness, clock, env, or locale.
 */
export function compareThreatPriority(
  a: AirDefenseAttack,
  b: AirDefenseAttack,
  defenderId: string,
): number {
  // (1) §17.1: weapons already released before aircraft pre-release.
  if (a.isReleased !== b.isReleased) return a.isReleased ? -1 : 1;
  // (2) §17 "closest to impact" / §17.6: smaller timeToImpactMs first.
  if (a.timeToImpactMs !== b.timeToImpactMs) return a.timeToImpactMs < b.timeToImpactMs ? -1 : 1;
  // (3) §17.3-4: threats against the defended ship before protected nearby ships.
  const aDefendsDefender = a.targetId === defenderId;
  const bDefendsDefender = b.targetId === defenderId;
  if (aDefendsDefender !== bDefendsDefender) return aDefendsDefender ? -1 : 1;
  // (4) §17.5: expected-damage proxy DESCENDING — larger formationSize first.
  if (a.formationSize !== b.formationSize) return a.formationSize > b.formationSize ? -1 : 1;
  // (5) §17.7: target identifier ASCENDING.
  if (a.targetId !== b.targetId) return a.targetId < b.targetId ? -1 : 1;
  return 0;
}

// ---- §11 assignment ----

/** One director channel on the defended ship. Only operational channels are assignable. */
export interface DirectorChannel {
  /** Stable director identifier — §11 ordering key 5 (director identifier ascending). */
  directorId: string;
  /** True when the director is operational (§11 line 196; §12 counts operational directors). */
  operational: boolean;
}

/** A (system, attack) engagement candidate that passed layer eligibility (§7-§9, §15). */
export interface DirectorAssignmentCandidate {
  systemId: string;
  attackId: string;
}

export interface DirectorAssignmentInput {
  /** The defended ship's identifier (threat comparator key 3, §17.3-4). */
  defenderId: string;
  /** The defended ship's systems. Every candidate's systemId MUST be present (fail-closed). */
  systems: ReadonlyArray<AirDefenseSystemDefinition>;
  /** The incoming attacks. Every candidate's attackId MUST be present (fail-closed). */
  attacks: ReadonlyArray<AirDefenseAttack>;
  /** The engagements directors are assigned to (one candidate = one engagement channel). */
  candidates: ReadonlyArray<DirectorAssignmentCandidate>;
  /** The ship's director channels, keyed by identifier for reproducible ordering. */
  directorChannels: ReadonlyArray<DirectorChannel>;
  /** Ship/system operability (§7/§15): an inoperable ship or system contributes zero and
   *  receives no director. */
  operability: AirDefenseOperability;
}

export interface DirectorAssignmentEntry {
  systemId: string;
  attackId: string;
  layer: LayerId;
  /**
   * The operational director assigned to this engagement (lowest director identifier
   * allocated first, §11 key 5), or null when no operational director channel was free.
   */
  directorId: string | null;
  /** AIR_DEFENSE_DIRECTOR_UNAVAILABLE when no director was assigned, else null. */
  reason: string | null;
}

export interface DirectorAssignmentResult {
  /** Entries in §11 assignment order — the order directors were allocated. */
  assignments: ReadonlyArray<DirectorAssignmentEntry>;
  /** §12: number of OPERATIONAL director channels on the defended ship. */
  operationalDirectorCount: SafeInt;
  /** §12 aggregate directed-fire value (SLOT MAPPING: the §19 directorMultiplierBp input). */
  directorFactorBp: SafeInt;
  /** §28 markers accompanying the factor (AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED at 5+). */
  markers: ReadonlyArray<string>;
}

// Codepoint comparator for deterministic string ordering (never localeCompare).
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Full §11 candidate order: (1) defense layer priority (§1: HEAVY_AA < MEDIUM_AA < LIGHT_AA
 * < CIWS_TERMINAL_DEFENSE), (2) threat score descending (the §17 comparator), (3) time to
 * impact ascending, (4) target identifier ascending, then (5) a deterministic residue —
 * systemId, then attackId ascending (codepoint). Keys 3 and 4 are already enforced by the
 * §17 comparator (keys 2 and 5) and are asserted again explicitly so the code mirrors the
 * written §11 chain; the residue guarantees a TOTAL order so input array order can never
 * leak into results (§27 line 453).
 */
function compareCandidates(
  a: { system: AirDefenseSystemDefinition; attack: AirDefenseAttack },
  b: { system: AirDefenseSystemDefinition; attack: AirDefenseAttack },
  defenderId: string,
): number {
  // 1. §11.1 defense layer priority — canonical §1 order.
  const aLayer = DEFENSE_LAYER_ORDER.indexOf(a.system.layer);
  const bLayer = DEFENSE_LAYER_ORDER.indexOf(b.system.layer);
  if (aLayer !== bLayer) return aLayer - bLayer;
  // 2. §11.2 threat score descending (§17 comparator).
  const threat = compareThreatPriority(a.attack, b.attack, defenderId);
  if (threat !== 0) return threat;
  // 3. §11.3 time to impact ascending.
  if (a.attack.timeToImpactMs !== b.attack.timeToImpactMs) {
    return a.attack.timeToImpactMs < b.attack.timeToImpactMs ? -1 : 1;
  }
  // 4. §11.4 target identifier ascending.
  if (a.attack.targetId !== b.attack.targetId) {
    return a.attack.targetId < b.attack.targetId ? -1 : 1;
  }
  // 5. deterministic total-order residue: systemId, then attackId (codepoint ascending).
  if (a.system.systemId !== b.system.systemId)
    return byCodeUnit(a.system.systemId, b.system.systemId);
  return byCodeUnit(a.attack.attackId, b.attack.attackId);
}

/**
 * A: AC-8 (§11) — assigns the defended ship's operational directors to the (system, attack)
 * candidates in the §11 total order. Each engagement receives exactly one operational
 * director (one director = one engagement channel, §11 line 196 / §1 line 22; a director is
 * never reused within the pass, satisfying §11 line 206 "one director MUST NOT provide its
 * full modifier to two simultaneous groups"). Candidates beyond the operational-director
 * supply are reported unassigned with AIR_DEFENSE_DIRECTOR_UNAVAILABLE. Also returns the
 * operational director count and the §12 aggregate director factor (B). Fail-closed with
 * INVALID_AIR_DEFENSE_STATE on inconsistent input: unknown systemId/attackId in a candidate,
 * an unknown defense layer, duplicate candidate pairs, duplicate director identifiers, an
 * empty defenderId, or non-safe/negative derived counts.
 */
export function assignAADirectors(input: DirectorAssignmentInput): DirectorAssignmentResult {
  const { defenderId, systems, attacks, candidates, directorChannels, operability } = input;

  if (typeof defenderId !== "string" || defenderId.length === 0) {
    throw new BluewaveError("assignAADirectors: defenderId must be a non-empty string", {
      code: INVALID_AIR_DEFENSE_STATE,
    });
  }

  const systemById = new Map<string, AirDefenseSystemDefinition>();
  for (const system of systems) {
    if (systemById.has(system.systemId)) {
      throw new BluewaveError("assignAADirectors: duplicate systemId in systems", {
        code: INVALID_AIR_DEFENSE_STATE,
        systemId: system.systemId,
      });
    }
    systemById.set(system.systemId, system);
  }
  const attackById = new Map<string, AirDefenseAttack>();
  for (const attack of attacks) {
    if (attackById.has(attack.attackId)) {
      throw new BluewaveError("assignAADirectors: duplicate attackId in attacks", {
        code: INVALID_AIR_DEFENSE_STATE,
        attackId: attack.attackId,
      });
    }
    attackById.set(attack.attackId, attack);
  }

  // Resolve every candidate against the authoritative systems/attacks (fail-closed).
  const resolved: Array<{ system: AirDefenseSystemDefinition; attack: AirDefenseAttack }> = [];
  const seenPairs = new Set<string>();
  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== "object") {
      throw new BluewaveError("assignAADirectors: malformed candidate", {
        code: INVALID_AIR_DEFENSE_STATE,
      });
    }
    const system = systemById.get(candidate.systemId);
    if (system === undefined) {
      throw new BluewaveError("assignAADirectors: candidate references an unknown system", {
        code: INVALID_AIR_DEFENSE_STATE,
        systemId: candidate.systemId,
      });
    }
    if (!isValidLayer(system.layer)) {
      throw new BluewaveError("assignAADirectors: candidate system has an unknown defense layer", {
        code: INVALID_AIR_DEFENSE_STATE,
        systemId: candidate.systemId,
        layer: system.layer,
      });
    }
    const attack = attackById.get(candidate.attackId);
    if (attack === undefined) {
      throw new BluewaveError("assignAADirectors: candidate references an unknown attack", {
        code: INVALID_AIR_DEFENSE_STATE,
        attackId: candidate.attackId,
      });
    }
    const pairKey = `${candidate.systemId}\u0000${candidate.attackId}`;
    if (seenPairs.has(pairKey)) {
      throw new BluewaveError("assignAADirectors: duplicate (system, attack) candidate", {
        code: INVALID_AIR_DEFENSE_STATE,
        systemId: candidate.systemId,
        attackId: candidate.attackId,
      });
    }
    seenPairs.add(pairKey);
    resolved.push({ system, attack });
  }

  // Director channels: duplicate identifiers are inconsistent (they corrupt §11 key 5
  // ordering); non-operational channels are simply not assignable (§11 line 196).
  const seenDirectorIds = new Set<string>();
  for (const channel of directorChannels) {
    if (typeof channel.directorId !== "string" || channel.directorId.length === 0) {
      throw new BluewaveError("assignAADirectors: directorId must be a non-empty string", {
        code: INVALID_AIR_DEFENSE_STATE,
      });
    }
    if (seenDirectorIds.has(channel.directorId)) {
      throw new BluewaveError("assignAADirectors: duplicate directorId in directorChannels", {
        code: INVALID_AIR_DEFENSE_STATE,
        directorId: channel.directorId,
      });
    }
    seenDirectorIds.add(channel.directorId);
  }
  const operationalDirectors = directorChannels
    .filter((channel) => channel.operational)
    .map((channel) => channel.directorId)
    .sort(byCodeUnit); // §11 key 5: lowest director identifier allocated first.

  // An inoperable ship/system does not fire, so it contributes zero (§7 line 134, §15 line
  // 266) and receives no director assignment.
  const shipOperable = isSystemOperable(operability);

  const ordered = [...resolved].sort((a, b) => compareCandidates(a, b, defenderId));

  const assignments: DirectorAssignmentEntry[] = [];
  let nextDirectorIndex = 0;
  for (const { system, attack } of ordered) {
    let directorId: string | null = null;
    if (shipOperable && nextDirectorIndex < operationalDirectors.length) {
      const next = operationalDirectors[nextDirectorIndex];
      if (next !== undefined) {
        directorId = next;
        nextDirectorIndex++;
      }
    }
    assignments.push({
      systemId: system.systemId,
      attackId: attack.attackId,
      layer: system.layer,
      directorId,
      reason: directorId === null ? AIR_DEFENSE_DIRECTOR_UNAVAILABLE : null,
    });
  }

  const operationalDirectorCount = SafeInt(operationalDirectors.length);
  return {
    assignments,
    operationalDirectorCount,
    directorFactorBp: computeDirectorFactorBp(operationalDirectors.length),
    markers: directorScalingMarkers(operationalDirectors.length),
  };
}
