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

export function computeLightAaEligibility(
  input: LightAaEligibilityInput,
): LightAaEligibilityResult {
  const { system, attack, operability, channelAvailable, ammunitionAvailable } = input;

  const profile = lightAaProfileForAttack(attack.attackType);

  let baseWindowMilliseconds: SafeInt | null = null;
  if (profile !== null) {
    if (profile === "GUIDED") {
      baseWindowMilliseconds = SafeInt(60_000);
    } else if (profile === "LIGHT_ASM") {
      baseWindowMilliseconds = null;
    } else {
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
