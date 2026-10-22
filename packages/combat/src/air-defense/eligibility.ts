import { AttackType, AttackTypeId } from "./attack.js";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseSystemDefinition, LayerId } from "./air-defense-system-definition.js";
import {
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
} from "./reasonCodes.js";

export interface AirDefenseOperability {
  defenderSunk: boolean;
  defenderAbandoned: boolean;
  systemPowered: boolean;
  systemOperational: boolean;
}

export function isSystemOperable(operability: AirDefenseOperability): boolean {
  return (
    !operability.defenderSunk &&
    !operability.defenderAbandoned &&
    operability.systemPowered &&
    operability.systemOperational
  );
}

export type LightAaProfileKey =
  | "LEVEL"
  | "DIVE"
  | "SKIP"
  | "TORPEDO"
  | "ROCKET"
  | "GUIDED"
  | "LIGHT_ASM";

export function lightAaProfileForAttack(attackType: AttackTypeId): LightAaProfileKey | null {
  switch (attackType) {
    case AttackType.AIRCRAFT_LEVEL_BOMBING:
      return "LEVEL";
    case AttackType.AIRCRAFT_DIVE_BOMBING:
      return "DIVE";
    case AttackType.AIRCRAFT_SKIP_BOMBING:
      return "SKIP";
    case AttackType.AIRCRAFT_TORPEDO_ATTACK:
      return "TORPEDO";
    case AttackType.AIRCRAFT_ROCKET_ATTACK:
      return "ROCKET";
    case AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK:
      return "GUIDED";
    case AttackType.ANTI_RADIATION_WEAPON:
      return "GUIDED";
    case AttackType.LIGHT_ASM:
      return "LIGHT_ASM";
    default:
      return null;
  }
}

export const LAYER_ATTACK_ELIGIBILITY_MATRIX: Readonly<Record<LayerId, readonly AttackTypeId[]>> = {
  HEAVY_AA: [
    AttackType.AIRCRAFT_LEVEL_BOMBING,
    AttackType.AIRCRAFT_ROCKET_ATTACK,
    AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
    AttackType.ANTI_RADIATION_WEAPON,
    AttackType.LIGHT_ASM,
  ],

  MEDIUM_AA: [
    AttackType.AIRCRAFT_LEVEL_BOMBING,
    AttackType.AIRCRAFT_DIVE_BOMBING,
    AttackType.AIRCRAFT_SKIP_BOMBING,
    AttackType.AIRCRAFT_TORPEDO_ATTACK,
    AttackType.AIRCRAFT_ROCKET_ATTACK,
    AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
    AttackType.ANTI_RADIATION_WEAPON,
  ],

  LIGHT_AA: [
    AttackType.AIRCRAFT_LEVEL_BOMBING,
    AttackType.AIRCRAFT_DIVE_BOMBING,
    AttackType.AIRCRAFT_SKIP_BOMBING,
    AttackType.AIRCRAFT_TORPEDO_ATTACK,
    AttackType.AIRCRAFT_ROCKET_ATTACK,
    AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
    AttackType.ANTI_RADIATION_WEAPON,
    AttackType.LIGHT_ASM,
    AttackType.MEDIUM_ASM,
    AttackType.HEAVY_ASM,
  ],

  CIWS_TERMINAL_DEFENSE: [
    AttackType.AIRCRAFT_LEVEL_BOMBING,
    AttackType.AIRCRAFT_DIVE_BOMBING,
    AttackType.AIRCRAFT_SKIP_BOMBING,
    AttackType.AIRCRAFT_TORPEDO_ATTACK,
    AttackType.AIRCRAFT_ROCKET_ATTACK,
    AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
    AttackType.ANTI_RADIATION_WEAPON,
    AttackType.LIGHT_ASM,
    AttackType.MEDIUM_ASM,
    AttackType.HEAVY_ASM,
  ],
};

export function layerAllowsAttackType(layer: LayerId, attackType: AttackTypeId): boolean {
  return LAYER_ATTACK_ELIGIBILITY_MATRIX[layer]?.includes(attackType) ?? false;
}

export function systemMayEngageAttack(
  system: AirDefenseSystemDefinition,
  attackType: AttackTypeId,
): boolean {
  return (
    layerAllowsAttackType(system.layer, attackType) && system.profileEligibility.has(attackType)
  );
}

export function isWithinEnvelope(
  system: AirDefenseSystemDefinition,
  attack: AirDefenseAttack,
): boolean {
  if (attack.currentRangeM < system.rangeMinM) return false;
  if (attack.currentRangeM > system.rangeMaxM) return false;
  if (attack.currentAltitudeM < system.altitudeMinM) return false;
  if (attack.currentAltitudeM > system.altitudeMaxM) return false;
  if (attack.speedMps > system.targetSpeedLimitMps) return false;
  return true;
}

export function isWithinArc(system: AirDefenseSystemDefinition, attack: AirDefenseAttack): boolean {
  return attack.bearingDegrees <= system.arcDegreesMax;
}

export interface CiwsEligibilityInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  operability: AirDefenseOperability;
  channelAvailable: boolean;
  ammunitionAvailable: boolean;
}

export interface CiwsEligibilityResult {
  eligible: boolean;
  reason: string | null;
}

export function isCiwsEligible(input: CiwsEligibilityInput): CiwsEligibilityResult {
  const { system, attack, operability, channelAvailable, ammunitionAvailable } = input;

  if (!systemMayEngageAttack(system, attack.attackType)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }
  if (!isWithinEnvelope(system, attack)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }
  if (!isWithinArc(system, attack)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }
  if (!isSystemOperable(operability)) {
    return { eligible: false, reason: AIR_DEFENSE_TARGET_INELIGIBLE };
  }
  if (!channelAvailable) {
    return { eligible: false, reason: AIR_DEFENSE_CHANNEL_UNAVAILABLE };
  }
  if (!ammunitionAvailable) {
    return { eligible: false, reason: AIR_DEFENSE_AMMUNITION_UNAVAILABLE };
  }
  return { eligible: true, reason: null };
}
