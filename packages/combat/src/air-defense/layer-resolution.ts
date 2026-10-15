// D-4 M4 Aviation: Air Defense — AC-3 layer resolution per DESIGN-45 §1.
// Defense layers resolve in exact canonical order HEAVY_AA → MEDIUM_AA → LIGHT_AA →
// CIWS_TERMINAL_DEFENSE (CAP + SAM deferred). A layer with no eligible system emits a
// successful empty result. INC-2 resolves per-layer eligibility for ALL attacks and leaves
// the attack set unchanged: the survival flow ("a surviving attack proceeds to the next
// eligible layer", §1 line 20) becomes meaningful when INC-3 adds engagement outcomes
// (kill/abort). No kill/abort is fabricated here.

import type { SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseOperability } from "./eligibility.js";
import { isCiwsEligible } from "./eligibility.js";
import { isHeavyAaEligible } from "./heavy-aa-eligibility.js";
import { isMediumAaEligible } from "./medium-aa-eligibility.js";
import { computeLightAaEligibility } from "./light-aa-eligibility.js";

/** The four shipped AA defense layers in §1 canonical order (CAP + SAM deferred). */
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
  /**
   * True when the layer had no eligible system — the §1 "successful empty result"
   * (a layer with no eligible system MUST emit a successful empty result). This includes
   * layers that have no systems at all in the input.
   */
  emptyEligible: boolean;
}

export interface LayerResolutionInput {
  defenderId: string;
  systems: ReadonlyArray<AirDefenseSystemDefinition>;
  attacks: ReadonlyArray<AirDefenseAttack>;
  operability: AirDefenseOperability;
  /** attacked ship id → distance from the defender (used when targetId !== defenderId). */
  protectedShipDistanceM: ReadonlyMap<string, SafeInt>;
  directorAvailable: boolean;
  radarAvailable: boolean;
  /** systemId → rounds remaining. 0 → empty/zero contribution (§20); absent → assume supply present (INC-2). */
  ammunitionBySystem: ReadonlyMap<string, SafeInt>;
  /** systemId → engagement channel free. Absent → assume channel free (INC-2). */
  channelAvailableBySystem: ReadonlyMap<string, boolean>;
}

// Codepoint comparator: string ordering uses < / > (never localeCompare).
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

/**
 * Resolves every shipped layer in canonical order. For each layer, systems of that layer
 * are evaluated in codepoint systemId ascending order, and each system's attacks in input
 * order (deterministic candidate ordering). One resolution is emitted per layer even when
 * the layer has no systems (successful empty result).
 */
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
