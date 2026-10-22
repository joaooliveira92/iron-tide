import type { SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import { HEAVY_AA_PROTECTED_RADIUS_M } from "./constants.js";
import type { AirDefenseOperability } from "./eligibility.js";
import {
  isSystemOperable,
  isWithinArc,
  isWithinEnvelope,
  systemMayEngageAttack,
} from "./eligibility.js";
import {
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AIR_DEFENSE_RADAR_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  HEAVY_AA_PROTECTED_RADIUS_EXCEEDED,
} from "./reasonCodes.js";

export interface HeavyAaEligibilityInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  defenderId: string;
  protectedShipDistanceM: SafeInt | null;
  operability: AirDefenseOperability;
  directorAvailable: boolean;
  radarAvailable: boolean;
  ammunitionAvailable: boolean;
}

export type HeavyAaIneligibilityReason =
  | typeof AIR_DEFENSE_TARGET_INELIGIBLE
  | typeof HEAVY_AA_PROTECTED_RADIUS_EXCEEDED
  | typeof AIR_DEFENSE_DIRECTOR_UNAVAILABLE
  | typeof AIR_DEFENSE_RADAR_UNAVAILABLE
  | typeof AIR_DEFENSE_AMMUNITION_UNAVAILABLE;

export interface HeavyAaEligibilityResult {
  eligible: boolean;
  reason: HeavyAaIneligibilityReason | null;
}

export function isHeavyAaEligible(input: HeavyAaEligibilityInput): HeavyAaEligibilityResult {
  const {
    system,
    attack,
    defenderId,
    protectedShipDistanceM,
    operability,
    directorAvailable,
    radarAvailable,
    ammunitionAvailable,
  } = input;

  if (!systemMayEngageAttack(system, attack.attackType)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }

  if (attack.targetId !== defenderId) {
    if (protectedShipDistanceM === null) {
      return { eligible: false, reason: HEAVY_AA_PROTECTED_RADIUS_EXCEEDED };
    }
    if (protectedShipDistanceM > HEAVY_AA_PROTECTED_RADIUS_M) {
      return { eligible: false, reason: HEAVY_AA_PROTECTED_RADIUS_EXCEEDED };
    }
  }

  if (!isWithinEnvelope(system, attack)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }
  if (!isWithinArc(system, attack)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }
  if (!directorAvailable) {
    return { eligible: false, reason: AIR_DEFENSE_DIRECTOR_UNAVAILABLE };
  }
  if (!radarAvailable) {
    return { eligible: false, reason: AIR_DEFENSE_RADAR_UNAVAILABLE };
  }
  if (!ammunitionAvailable) {
    return { eligible: false, reason: AIR_DEFENSE_AMMUNITION_UNAVAILABLE };
  }
  if (!isSystemOperable(operability)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }

  return { eligible: true, reason: null };
}
