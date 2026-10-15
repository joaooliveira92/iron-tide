// packages/combat/src/air-defense/heavy-aa-eligibility.ts
// D-4 M4 Aviation: Air Defense — AC-4 heavy-AA eligibility per DESIGN-45 §7.
// Heavy AA may engage an aircraft formation attacking the defended ship or a nearby
// protected ship within exactly 5 nautical miles (9_260 m) of the heavy-AA ship, when the
// target lies within the system's range/altitude/speed/arc/director/radar/ammunition/power
// limits and the firing ship is not sunk, abandoned, or unable to operate the system.

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
  /** The heavy-AA ship's id (the defender this heavy-AA mount belongs to). */
  defenderId: string;
  /**
   * Distance from the heavy-AA ship to the attacked ship when the attacked ship is NOT the
   * defender; null when the attacked ship IS the defender (own-ship protection, §7).
   */
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

/**
 * Canonical heavy-AA eligibility predicate order (§7). Fixed for deterministic reason
 * reporting:
 *   1. attack type allowed by §18 matrix AND the system's profileEligibility;
 *   2. own ship vs protected nearby ship within exactly 5 nm (9_260 m) — a heavy-AA system
 *      MUST NOT engage an unrelated formation outside its protected radius (§7 line 138);
 *   3. range/altitude/speed envelope;
 *   4. bearing arc;
 *   5. director/radar/ammunition availability;
 *   6. ship not sunk/abandoned and system powered/operational;
 *   7. eligible.
 */
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
