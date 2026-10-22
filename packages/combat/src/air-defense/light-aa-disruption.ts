import { BluewaveError, SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import type { AirDefenseOperability } from "./eligibility.js";
import {
  isSystemOperable,
  isWithinArc,
  isWithinEnvelope,
  systemMayEngageAttack,
} from "./eligibility.js";
import type { LightAaEligibilityResult } from "./light-aa-eligibility.js";
import {
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_INVARIANT_FAILED,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
} from "./reasonCodes.js";

export interface LightAaDisruptionTiming {
  minute: SafeInt;
  substep: SafeInt;
}

export interface LightAaDisruptionInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  operability: AirDefenseOperability;
  channelAvailable: boolean;
  ammunitionAvailable: boolean;
  eligibility: LightAaEligibilityResult;
  timing: LightAaDisruptionTiming;
}

export interface LightAaDisruptionOpportunityResult {
  opportunityCreated: boolean;
  checkMinute: SafeInt;
  checkSubstep: SafeInt;
  reasonCode: string;
}

export function resolveGuaranteedLightAaDisruptionOpportunity(
  input: LightAaDisruptionInput,
): LightAaDisruptionOpportunityResult {
  const {
    system,
    attack,
    operability,
    channelAvailable,
    ammunitionAvailable,
    eligibility,
    timing,
  } = input;

  const blocked = (reasonCode: string): LightAaDisruptionOpportunityResult => ({
    opportunityCreated: false,
    checkMinute: timing.minute,
    checkSubstep: timing.substep,
    reasonCode,
  });

  if (!systemMayEngageAttack(system, attack.attackType)) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the system may not engage the attack type",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  if (!isSystemOperable(operability)) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the system is inoperable",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  if (!isWithinArc(system, attack)) {
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  if (!isWithinEnvelope(system, attack)) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the attack is outside the envelope",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  if (!channelAvailable) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the channel is unavailable",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_CHANNEL_UNAVAILABLE);
  }
  if (!ammunitionAvailable) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but ammunition is unavailable",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_AMMUNITION_UNAVAILABLE);
  }
  if (!eligibility.eligible) {
    return blocked(eligibility.reason ?? AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  return {
    opportunityCreated: true,
    checkMinute: timing.minute,
    checkSubstep: timing.substep,
    reasonCode: LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
  };
}
