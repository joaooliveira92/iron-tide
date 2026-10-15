// packages/combat/src/air-defense/medium-aa-eligibility.ts
// D-4 M4 Aviation: Air Defense — AC-5 medium-AA eligibility + pre-release timing per §8.
// Medium AA may engage only an attack profile explicitly marked mediumAaEligible, and
// receives ONE pre-release engagement window when the attacker enters range before weapon
// release. The window opens when every §8 predicate passes.

import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import { MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP } from "./constants.js";
import type { AirDefenseOperability } from "./eligibility.js";
import { isSystemOperable, isWithinEnvelope, systemMayEngageAttack } from "./eligibility.js";
import {
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AIR_DEFENSE_RADAR_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED,
} from "./reasonCodes.js";

export type MediumAaWindowState =
  | "PRE_RELEASE_OPEN"
  | "PRE_RELEASE_MISSED"
  | "NOT_ELIGIBLE"
  | "OUT_OF_ENVELOPE"
  | "NO_FIRE_CONTROL_SOLUTION"
  | "RESOURCE_UNAVAILABLE";

export interface MediumAaEligibilityInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  operability: AirDefenseOperability;
  directorAvailable: boolean;
  radarAvailable: boolean;
  ammunitionAvailable: boolean;
  channelAvailable: boolean;
}

export type MediumAaIneligibilityReason =
  | typeof AIR_DEFENSE_TARGET_INELIGIBLE
  | typeof MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED
  | typeof AIR_DEFENSE_CHANNEL_UNAVAILABLE
  | typeof AIR_DEFENSE_AMMUNITION_UNAVAILABLE
  | typeof AIR_DEFENSE_DIRECTOR_UNAVAILABLE
  | typeof AIR_DEFENSE_RADAR_UNAVAILABLE;

export interface MediumAaEligibilityResult {
  eligible: boolean;
  window: MediumAaWindowState;
  reason: MediumAaIneligibilityReason | null;
}

/**
 * Canonical medium-AA eligibility + timing predicate order (§8 lines 144-153). Fixed for
 * deterministic reason reporting:
 *   1. §18 matrix + system profileEligibility (NOT_ELIGIBLE);
 *   2. range/altitude/speed envelope (OUT_OF_ENVELOPE);
 *   3. pre-release vs post-release — a released attack missed its one pre-release window.
 *      Post-release engagement is a MAY only when the system definition explicitly supports
 *      the released weapon type; post-release modeling is deferred to INC-3+, so any released
 *      attack is reported as PRE_RELEASE_MISSED here (§8 line 154);
 *   4. fire-control solution >= 4_000 bp (NO_FIRE_CONTROL_SOLUTION);
 *   5. free channel then ammunition (RESOURCE_UNAVAILABLE);
 *   6. ship/system operability then director then radar (RESOURCE_UNAVAILABLE);
 *   7. PRE_RELEASE_OPEN.
 */
export function isMediumAaEligible(input: MediumAaEligibilityInput): MediumAaEligibilityResult {
  const {
    system,
    attack,
    operability,
    directorAvailable,
    radarAvailable,
    ammunitionAvailable,
    channelAvailable,
  } = input;

  if (!systemMayEngageAttack(system, attack.attackType)) {
    return { eligible: false, window: "NOT_ELIGIBLE", reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }

  if (!isWithinEnvelope(system, attack)) {
    return { eligible: false, window: "OUT_OF_ENVELOPE", reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }

  if (attack.isReleased) {
    return {
      eligible: false,
      window: "PRE_RELEASE_MISSED",
      reason: MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED,
    };
  }

  if (attack.fireControlSolutionBp < MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP) {
    return {
      eligible: false,
      window: "NO_FIRE_CONTROL_SOLUTION",
      reason: AIR_DEFENSE_TARGET_INELIGIBLE,
    };
  }

  if (!channelAvailable) {
    return {
      eligible: false,
      window: "RESOURCE_UNAVAILABLE",
      reason: AIR_DEFENSE_CHANNEL_UNAVAILABLE,
    };
  }
  if (!ammunitionAvailable) {
    return {
      eligible: false,
      window: "RESOURCE_UNAVAILABLE",
      reason: AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
    };
  }
  if (!isSystemOperable(operability)) {
    return {
      eligible: false,
      window: "RESOURCE_UNAVAILABLE",
      reason: AIR_DEFENSE_TARGET_INELIGIBLE,
    };
  }
  if (!directorAvailable) {
    return {
      eligible: false,
      window: "RESOURCE_UNAVAILABLE",
      reason: AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
    };
  }
  if (!radarAvailable) {
    return {
      eligible: false,
      window: "RESOURCE_UNAVAILABLE",
      reason: AIR_DEFENSE_RADAR_UNAVAILABLE,
    };
  }

  return { eligible: true, window: "PRE_RELEASE_OPEN", reason: null };
}
