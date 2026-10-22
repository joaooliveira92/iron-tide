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

export const DIRECTOR_NORMAL_SCALING_CAP =
  DIRECTOR_SCALING_TABLE[DIRECTOR_SCALING_TABLE.length - 1]![0];

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

export function compareThreatPriority(
  a: AirDefenseAttack,
  b: AirDefenseAttack,
  defenderId: string,
): number {
  if (a.isReleased !== b.isReleased) return a.isReleased ? -1 : 1;
  if (a.timeToImpactMs !== b.timeToImpactMs) return a.timeToImpactMs < b.timeToImpactMs ? -1 : 1;
  const aDefendsDefender = a.targetId === defenderId;
  const bDefendsDefender = b.targetId === defenderId;
  if (aDefendsDefender !== bDefendsDefender) return aDefendsDefender ? -1 : 1;
  if (a.formationSize !== b.formationSize) return a.formationSize > b.formationSize ? -1 : 1;
  if (a.targetId !== b.targetId) return a.targetId < b.targetId ? -1 : 1;
  return 0;
}

export interface DirectorChannel {
  directorId: string;
  operational: boolean;
}

export interface DirectorAssignmentCandidate {
  systemId: string;
  attackId: string;
}

export interface DirectorAssignmentInput {
  defenderId: string;
  systems: ReadonlyArray<AirDefenseSystemDefinition>;
  attacks: ReadonlyArray<AirDefenseAttack>;
  candidates: ReadonlyArray<DirectorAssignmentCandidate>;
  directorChannels: ReadonlyArray<DirectorChannel>;
  operability: AirDefenseOperability;
}

export interface DirectorAssignmentEntry {
  systemId: string;
  attackId: string;
  layer: LayerId;
  directorId: string | null;
  reason: string | null;
}

export interface DirectorAssignmentResult {
  assignments: ReadonlyArray<DirectorAssignmentEntry>;
  operationalDirectorCount: SafeInt;
  directorFactorBp: SafeInt;
  markers: ReadonlyArray<string>;
}

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCandidates(
  a: { system: AirDefenseSystemDefinition; attack: AirDefenseAttack },
  b: { system: AirDefenseSystemDefinition; attack: AirDefenseAttack },
  defenderId: string,
): number {
  const aLayer = DEFENSE_LAYER_ORDER.indexOf(a.system.layer);
  const bLayer = DEFENSE_LAYER_ORDER.indexOf(b.system.layer);
  if (aLayer !== bLayer) return aLayer - bLayer;
  const threat = compareThreatPriority(a.attack, b.attack, defenderId);
  if (threat !== 0) return threat;
  if (a.attack.timeToImpactMs !== b.attack.timeToImpactMs) {
    return a.attack.timeToImpactMs < b.attack.timeToImpactMs ? -1 : 1;
  }
  if (a.attack.targetId !== b.attack.targetId) {
    return a.attack.targetId < b.attack.targetId ? -1 : 1;
  }
  if (a.system.systemId !== b.system.systemId)
    return byCodeUnit(a.system.systemId, b.system.systemId);
  return byCodeUnit(a.attack.attackId, b.attack.attackId);
}

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
    .sort(byCodeUnit);

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
