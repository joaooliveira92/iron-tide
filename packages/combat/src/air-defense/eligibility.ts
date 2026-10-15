// D-4 M4 Aviation: Air Defense — shared eligibility machinery.
// Layer-agnostic predicates used by the per-layer eligibility modules and by
// layer resolution (AC-3..AC-6; DESIGN-45 §1, §7, §8, §9, §15-16, §18).

import { AttackType, AttackTypeId } from "./attack.js";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseSystemDefinition, LayerId } from "./air-defense-system-definition.js";
import {
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
} from "./reasonCodes.js";

// ---- AirDefenseOperability ----
// System-level OPERATIONAL/DAMAGED/DESTROYED simplified model (§21) plus ship state.
export interface AirDefenseOperability {
  defenderSunk: boolean;
  defenderAbandoned: boolean;
  systemPowered: boolean;
  systemOperational: boolean;
}

/**
 * True when the defending ship is afloat, not abandoned, and the system has power and
 * is operationally capable. Mirrors §7: "the firing ship is not sunk, abandoned, or
 * unable to operate the system" and §15: "damaged, unpowered ... CIWS contributes zero".
 */
export function isSystemOperable(operability: AirDefenseOperability): boolean {
  return (
    !operability.defenderSunk &&
    !operability.defenderAbandoned &&
    operability.systemPowered &&
    operability.systemOperational
  );
}

// ---- Light AA profile key (§9) ----

export type LightAaProfileKey =
  | "LEVEL"
  | "DIVE"
  | "SKIP"
  | "TORPEDO"
  | "ROCKET"
  | "GUIDED"
  | "LIGHT_ASM";

/**
 * Maps an attack type to its §9 light-AA window profile.
 * MEDIUM_ASM, HEAVY_ASM and SPECIAL_EXPLICIT_ATTACK return null: §9 ships no base window
 * for them (medium/heavy ASM are ineligible unless the light-AA system explicitly lists
 * them; special attacks are only engageable via an explicit system listing).
 */
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
      return "GUIDED"; // guided-class weapon (§9 line 166)
    case AttackType.LIGHT_ASM:
      return "LIGHT_ASM";
    default:
      return null; // MEDIUM_ASM, HEAVY_ASM, SPECIAL_EXPLICIT_ATTACK
  }
}

// ---- §18 attack-layer eligibility matrix ----
// The shipped eligibility matrix restricted to the four AA layers (CAP + SAM deferred).
// SPECIAL_EXPLICIT_ATTACK is never in a matrix: it may only be engaged through an explicit
// system listing (see systemMayEngageAttack). Each entry cites its §18 basis.
export const LAYER_ATTACK_ELIGIBILITY_MATRIX: Readonly<Record<LayerId, readonly AttackTypeId[]>> = {
  // §18 line 314: "level bombing and rockets: CAP and applicable SAM and AA layers" —
  // heavy AA engages level bombing and rockets; §18 line 316 (guided/missile attack
  // aircraft engaged before release); §18 line 313 (light ASM: HEAVY_AA when explicitly capable).
  // Dive/skip/torpedo deliberately absent: §18 line 315 sends them to medium AA/light AA/CIWS.
  HEAVY_AA: [
    AttackType.AIRCRAFT_LEVEL_BOMBING,
    AttackType.AIRCRAFT_ROCKET_ATTACK,
    AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
    AttackType.ANTI_RADIATION_WEAPON,
    AttackType.LIGHT_ASM,
  ],

  // §18 lines 314-316: medium AA covers conventional attacks (level/rocket) and
  // guided/missile attack aircraft engaged before release; §18 line 315 includes
  // dive/skip/torpedo "before release". Light ASM is deliberately absent: §18 line 313
  // lists its layers as CAP/MEDIUM_SAM/LIGHT_SAM/HEAVY_AA/LIGHT_AA/CIWS only, and
  // §18 line 318 forbids a layer absent from the attack's explicit eligibility set.
  MEDIUM_AA: [
    AttackType.AIRCRAFT_LEVEL_BOMBING,
    AttackType.AIRCRAFT_DIVE_BOMBING,
    AttackType.AIRCRAFT_SKIP_BOMBING,
    AttackType.AIRCRAFT_TORPEDO_ATTACK,
    AttackType.AIRCRAFT_ROCKET_ATTACK,
    AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
    AttackType.ANTI_RADIATION_WEAPON,
  ],

  // §18 lines 313-316: light AA covers conventional + guided classes. MEDIUM_ASM/HEAVY_ASM
  // are present only because §9 requires an explicit system listing for them; the matrix
  // authorizes the layer, systemMayEngageAttack additionally requires the system's
  // profileEligibility to list the type.
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

  // §18 lines 311-312: heavy/medium ASM engageable by "compatible terminal defense" (CIWS);
  // §18 lines 313-315: CIWS also covers light ASM and the conventional/guided classes.
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

/** True when the layer's canonical §18 matrix includes the attack type. */
export function layerAllowsAttackType(layer: LayerId, attackType: AttackTypeId): boolean {
  return LAYER_ATTACK_ELIGIBILITY_MATRIX[layer]?.includes(attackType) ?? false;
}

/**
 * True when the system may engage the attack type. The attack type must be in BOTH the
 * layer's canonical §18 matrix AND the system's authored profileEligibility set. This
 * realizes the spec's "explicitly capable / explicitly lists" language (§18 line 318,
 * §9 line 169): the matrix authorizes the layer class; the system definition authorizes
 * this particular weapon.
 */
export function systemMayEngageAttack(
  system: AirDefenseSystemDefinition,
  attackType: AttackTypeId,
): boolean {
  return (
    layerAllowsAttackType(system.layer, attackType) && system.profileEligibility.has(attackType)
  );
}

/** True when the attack lies within the system's range, altitude, and speed envelope (§3). */
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

/** True when the attack's bearing falls within the mount's arc (spec §1.1 item 4). */
export function isWithinArc(system: AirDefenseSystemDefinition, attack: AirDefenseAttack): boolean {
  return attack.bearingDegrees <= system.arcDegreesMax;
}

// ---- CIWS eligibility (INC-2 scope) ----
// §15: a CIWS system is one independent terminal-defense mount with its own engagement
// channel; a damaged, unpowered, empty, or out-of-arc CIWS contributes zero.
// INC-2 CIWS eligibility is the shared predicate set (matrix + envelope + arc + operability
// + channel + ammunition) WITHOUT the heavy-AA protected-radius logic: CIWS protects its own
// ship, and nearby-ship protection for CIWS is §25 (deferred).

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

/**
 * Canonical CIWS eligibility predicate order (deterministic reason reporting):
 * matrix/listing → envelope → arc → operability → channel → ammunition.
 */
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
