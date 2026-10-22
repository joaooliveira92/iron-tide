import type { SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseOperability } from "./eligibility.js";
import { isCiwsEligible } from "./eligibility.js";
import { isHeavyAaEligible } from "./heavy-aa-eligibility.js";
import { isMediumAaEligible } from "./medium-aa-eligibility.js";
import { computeLightAaEligibility } from "./light-aa-eligibility.js";

export const DEFENSE_LAYER_ORDER = [
  "HEAVY_AA",
  "MEDIUM_AA",
  "LIGHT_AA",
  "CIWS_TERMINAL_DEFENSE",
] as const;

export type DefenseLayerId = (typeof DEFENSE_LAYER_ORDER)[number];

export interface LayerEngagementCandidate {
  systemId: string;
  attackId: string;
  eligible: boolean;
  reason: string | null;
}

export interface DefenseLayerResolution {
  layer: DefenseLayerId;
  eligibleSystems: ReadonlyArray<AirDefenseSystemDefinition>;
  candidates: ReadonlyArray<LayerEngagementCandidate>;
  emptyEligible: boolean;
}

export interface LayerResolutionInput {
  defenderId: string;
  systems: ReadonlyArray<AirDefenseSystemDefinition>;
  attacks: ReadonlyArray<AirDefenseAttack>;
  operability: AirDefenseOperability;
  protectedShipDistanceM: ReadonlyMap<string, SafeInt>;
  directorAvailable: boolean;
  radarAvailable: boolean;
  ammunitionBySystem: ReadonlyMap<string, SafeInt>;
  channelAvailableBySystem: ReadonlyMap<string, boolean>;
}

function bySystemId(a: AirDefenseSystemDefinition, b: AirDefenseSystemDefinition): number {
  return a.systemId < b.systemId ? -1 : a.systemId > b.systemId ? 1 : 0;
}

interface LayerEvaluation {
  eligible: boolean;
  reason: string | null;
}

function evaluateForLayer(
  layer: DefenseLayerId,
  system: AirDefenseSystemDefinition,
  attack: AirDefenseAttack,
  input: LayerResolutionInput,
): LayerEvaluation {
  const ammo = input.ammunitionBySystem.get(system.systemId);
  const ammunitionAvailable = ammo === undefined ? true : ammo > 0;
  const channelAvailable = input.channelAvailableBySystem.get(system.systemId) ?? true;

  switch (layer) {
    case "HEAVY_AA": {
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: input.defenderId,
        protectedShipDistanceM:
          attack.targetId === input.defenderId
            ? null
            : (input.protectedShipDistanceM.get(attack.targetId) ?? null),
        operability: input.operability,
        directorAvailable: input.directorAvailable,
        radarAvailable: input.radarAvailable,
        ammunitionAvailable,
      });
      return { eligible: result.eligible, reason: result.reason };
    }
    case "MEDIUM_AA": {
      const result = isMediumAaEligible({
        system,
        attack,
        operability: input.operability,
        directorAvailable: input.directorAvailable,
        radarAvailable: input.radarAvailable,
        ammunitionAvailable,
        channelAvailable,
      });
      return { eligible: result.eligible, reason: result.reason };
    }
    case "LIGHT_AA": {
      const result = computeLightAaEligibility({
        system,
        attack,
        operability: input.operability,
        channelAvailable,
        ammunitionAvailable,
      });
      return { eligible: result.eligible, reason: result.reason };
    }
    case "CIWS_TERMINAL_DEFENSE": {
      const result = isCiwsEligible({
        system,
        attack,
        operability: input.operability,
        channelAvailable,
        ammunitionAvailable,
      });
      return { eligible: result.eligible, reason: result.reason };
    }
    default:
      return { eligible: false, reason: null };
  }
}

export function resolveDefenseLayers(
  input: LayerResolutionInput,
): ReadonlyArray<DefenseLayerResolution> {
  const results: DefenseLayerResolution[] = [];

  for (const layer of DEFENSE_LAYER_ORDER) {
    const layerSystems = input.systems.filter((sys) => sys.layer === layer).sort(bySystemId);

    const candidates: LayerEngagementCandidate[] = [];
    const eligibleSystemIds = new Set<string>();

    for (const system of layerSystems) {
      for (const attack of input.attacks) {
        const evaluation = evaluateForLayer(layer, system, attack, input);
        candidates.push({
          systemId: system.systemId,
          attackId: attack.attackId,
          eligible: evaluation.eligible,
          reason: evaluation.reason,
        });
        if (evaluation.eligible) {
          eligibleSystemIds.add(system.systemId);
        }
      }
    }

    const eligibleSystems = layerSystems.filter((sys) => eligibleSystemIds.has(sys.systemId));

    results.push({
      layer,
      eligibleSystems,
      candidates,
      emptyEligible: eligibleSystems.length === 0,
    });
  }

  return results;
}
