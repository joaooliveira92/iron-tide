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
