// D-4 M4 Aviation: Air Defense — AC-6 light-AA eligibility + windows per §9.
// Light-AA engagement windows are based on incoming speed and attack profile. Shipped base
// windows: level 2 min, dive 1 min, skip 1 min, torpedo 2 min, rocket 1 min, guided 1 min;
// light ASM is system-specific (null here); medium/heavy ASM are ineligible unless the
// system explicitly lists them.
// effectiveWindowMilliseconds = max(1_000, floor(baseWindowMilliseconds * speedWindowMultiplierBp / 10_000))

import { SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import {
  effectiveLightAAWindowMilliseconds,
  LIGHT_AA_WINDOW_DURATIONS,
  lightAASpeedMultiplierBp,
} from "./constants.js";
import type { AirDefenseOperability, LightAaProfileKey } from "./eligibility.js";
import {
  isSystemOperable,
  isWithinEnvelope,
  lightAaProfileForAttack,
  systemMayEngageAttack,
} from "./eligibility.js";
import {
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
} from "./reasonCodes.js";

export interface LightAaEligibilityInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  operability: AirDefenseOperability;
  channelAvailable: boolean;
  ammunitionAvailable: boolean;
}

export interface LightAaEligibilityResult {
  eligible: boolean;
  profile: LightAaProfileKey | null;
  baseWindowMilliseconds: SafeInt | null;
  speedMultiplierBp: SafeInt;
  effectiveWindowMilliseconds: SafeInt | null;
  withinEnvelope: boolean;
  windowOpen: boolean;
  reason: string | null;
}

/**
 * Canonical light-AA eligibility + window computation (§9). Fixed predicate order for
 * deterministic reason reporting:
 *   1. §18 matrix + system profileEligibility;
 *   2. profile + base window (GUIDED → 60_000 ms; LIGHT_ASM → null, system-specific
 *      terminal window — the guaranteed-disruption substep lands in INC-5; profile null →
 *      base window null);
 *   3. speed-band multiplier from speedKnots;
 *   4. effective window (or null);
 *   5. envelope + window open test;
 *   6. operability → channel → ammunition availability;
 *   7. eligible = windowOpen (with all resource predicates satisfied).
 */
export function computeLightAaEligibility(
  input: LightAaEligibilityInput,
): LightAaEligibilityResult {
  const { system, attack, operability, channelAvailable, ammunitionAvailable } = input;

  const profile = lightAaProfileForAttack(attack.attackType);

  let baseWindowMilliseconds: SafeInt | null = null;
  if (profile !== null) {
    if (profile === "GUIDED") {
      baseWindowMilliseconds = SafeInt(60_000); // §9 line 166: 1 minute against the aircraft
    } else if (profile === "LIGHT_ASM") {
      baseWindowMilliseconds = null; // §9 line 168: system-specific terminal window
    } else {
      // LEVEL/DIVE/SKIP/TORPEDO/ROCKET — seconds × 1_000 = ms (§9 lines 162-165).
      baseWindowMilliseconds = SafeInt(LIGHT_AA_WINDOW_DURATIONS[profile] * 1_000);
    }
  }

  const speedMultiplierBp = SafeInt(lightAASpeedMultiplierBp(Number(attack.speedKnots)));
  const effectiveWindowMilliseconds =
    baseWindowMilliseconds === null
      ? null
      : SafeInt(
          effectiveLightAAWindowMilliseconds(
            Number(baseWindowMilliseconds),
            Number(speedMultiplierBp),
          ),
        );

  const withinEnvelope = isWithinEnvelope(system, attack);
  const windowOpen =
    withinEnvelope &&
    (effectiveWindowMilliseconds === null
      ? profile === "LIGHT_ASM" && withinEnvelope
      : attack.timeToImpactMs <= effectiveWindowMilliseconds);

  let reason: string | null = null;
  if (!systemMayEngageAttack(system, attack.attackType)) {
    reason = AIR_DEFENSE_TARGET_INELIGIBLE;
  } else if (!isSystemOperable(operability)) {
    reason = AIR_DEFENSE_TARGET_INELIGIBLE;
  } else if (!channelAvailable) {
    reason = AIR_DEFENSE_CHANNEL_UNAVAILABLE;
  } else if (!ammunitionAvailable) {
    reason = AIR_DEFENSE_AMMUNITION_UNAVAILABLE;
  }

  const eligible = reason === null && windowOpen;
  if (!eligible && reason === null) {
    // Window closed: not yet in window, outside the envelope, or no shipped window for the
    // profile (e.g. MEDIUM_ASM/HEAVY_ASM even when explicitly listed). Reported under the
    // target-ineligible code at this INC.
    reason = AIR_DEFENSE_TARGET_INELIGIBLE;
  }

  return {
    eligible,
    profile,
    baseWindowMilliseconds,
    speedMultiplierBp,
    effectiveWindowMilliseconds,
    withinEnvelope,
    windowOpen,
    reason,
  };
}
