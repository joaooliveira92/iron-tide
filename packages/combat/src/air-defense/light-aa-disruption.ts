// D-4 M4 Aviation: Air Defense — AC-7 guaranteed light-AA disruption opportunity (§29.8-9).
//
// §29.8: "every eligible light-AA system receives at least one disruption check of one
// authoritative substep". §29.9: "the guaranteed light-AA opportunity does not guarantee
// ammunition, hit, damage, or abort".
//
// This module is the pure, deterministic OPPORTUNITY CREATION gate: it decides whether the
// one authoritative disruption-check substep is granted for a (system, attack) pair at a
// battle (minute, substep). It deliberately performs NO random draw — the disruption check
// itself (the §6 severity draw) happens at attack resolution (INC-6) against the
// opportunity's exact checkMinute/checkSubstep, so the disruptive hit/damage/abort effects
// are never guaranteed (a disruption check can resolve LIGHT/…/NO_EFFECT; the opportunity
// only guarantees the check occurs — §29.9). No ammunition is consumed and no engagement
// is fired by creating the opportunity.
//
// Canonical predicate chain (fixed order — deterministic reason reporting, mirroring the
// shared eligibility predicates and the light-AA eligibility module):
//   1. systemMayEngageAttack (§18 matrix + system listing)      → AIR_DEFENSE_TARGET_INELIGIBLE
//   2. isSystemOperable (§21: sunk/abandoned/unpowered/non-operational) → AIR_DEFENSE_TARGET_INELIGIBLE
//   3. isWithinArc (§1.1 item 4)                                 → AIR_DEFENSE_TARGET_INELIGIBLE
//   4. isWithinEnvelope (§3 range/altitude/speed)                → AIR_DEFENSE_TARGET_INELIGIBLE
//   5. channelAvailable (§11 one system/channel per engagement)  → AIR_DEFENSE_CHANNEL_UNAVAILABLE
//   6. ammunitionAvailable (§20)                                 → AIR_DEFENSE_AMMUNITION_UNAVAILABLE
//   7. eligibility.eligible (the §9 window/terminal-window result; the guaranteed check is
//      granted only inside the system's light-AA window)         → eligibility.reason ?? TARGET_INELIGIBLE
//   8. otherwise                                                 → opportunityCreated = true,
//      reasonCode = LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED, exactly ONE authoritative
//      substep (= input timing.substep).
//
// Fail-closed contradiction guard: if eligibility.eligible claims true while a DIRECT
// predicate (chain 1-2, 4-6 — the predicates computeLightAaEligibility shares) contradicts
// it, the module throws AIR_DEFENSE_INVARIANT_FAILED rather than guess — the opportunity
// must never be granted on inconsistent state ("Runtime inference and silent fallback
// behavior are prohibited"). The arc (step 3) is deliberately EXCLUDED: light-AA eligibility
// never checks the arc, so the resolver alone owns it and an out-of-arc attack reports
// TARGET_INELIGIBLE, never an invariant failure.

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

/** Battle timing of the ONE authoritative substep the disruption check is granted at. */
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
  /** The §9 eligibility result for the same (system, attack) — consumed as the window gate. */
  eligibility: LightAaEligibilityResult;
  timing: LightAaDisruptionTiming;
}

export interface LightAaDisruptionOpportunityResult {
  /** True only at the exact one authoritative substep; false for every prohibited case. */
  opportunityCreated: boolean;
  /** Battle minute of the granted (or attempted) disruption check. */
  checkMinute: SafeInt;
  /** Battle substep of the granted (or attempted) disruption check — the authoritative one. */
  checkSubstep: SafeInt;
  /**
   * LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED on grant; the first failing predicate's §28
   * code on prohibition (target-ineligible / channel / ammunition).
   */
  reasonCode: string;
}

/**
 * AC-7 (§29.8-9): resolves whether the guaranteed light-AA disruption opportunity is granted
 * at exactly ONE authoritative substep. Pure and deterministic: no randomness, clock, env,
 * or locale. The opportunity does NOT guarantee ammunition, hit, damage, or abort (§29.9) —
 * it only guarantees the disruption CHECK at the returned substep; roundsConsumed stays
 * zero and the outcome draw is deferred to attack resolution.
 */
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

  // 1. §18 matrix + system listing.
  if (!systemMayEngageAttack(system, attack.attackType)) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the system may not engage the attack type",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  // 2. §21 system operability (sunk / abandoned / unpowered / non-operational → zero).
  if (!isSystemOperable(operability)) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the system is inoperable",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  // 3. §1.1 item 4 arc (light-AA eligibility does NOT check the arc — enforced here). No
  //    contradiction guard for this step by design: computeLightAaEligibility cannot see the
  //    arc, so an out-of-arc attack inside the window is not an inconsistency — the missing
  //    predicate is added here, deterministically.
  if (!isWithinArc(system, attack)) {
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  // 4. §3 envelope (range / altitude / speed).
  if (!isWithinEnvelope(system, attack)) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the attack is outside the envelope",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  // 5. §11 one system/channel per engagement.
  if (!channelAvailable) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but the channel is unavailable",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_CHANNEL_UNAVAILABLE);
  }
  // 6. §20 ammunition availability.
  if (!ammunitionAvailable) {
    if (eligibility.eligible) {
      throw new BluewaveError(
        "resolveGuaranteedLightAaDisruptionOpportunity: eligibility claims eligible but ammunition is unavailable",
        { code: AIR_DEFENSE_INVARIANT_FAILED },
      );
    }
    return blocked(AIR_DEFENSE_AMMUNITION_UNAVAILABLE);
  }
  // 7. §9 window: the guaranteed check is granted only inside the system's light-AA window.
  if (!eligibility.eligible) {
    return blocked(eligibility.reason ?? AIR_DEFENSE_TARGET_INELIGIBLE);
  }
  // 8. Granted — exactly one authoritative substep (= the caller's battle substep).
  return {
    opportunityCreated: true,
    checkMinute: timing.minute,
    checkSubstep: timing.substep,
    reasonCode: LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
  };
}
