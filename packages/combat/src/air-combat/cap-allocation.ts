//packages/combat/src/air-combat/cap-allocation.ts
// D-3 M4 Aviation: CAP & Strikes — INC-2 (AC-4, AC-6): CAP allocation vs escort and bombers.
// Pure deterministic functions — no I/O, no random, no Date.

import { SafeInt } from "@bluewave/contracts";
import { AIR_COMBAT_BASIS_POINTS, AIR_COMBAT_DISRUPTION_MIN_BP } from "./constants.js";

/**
 * Computes CAP allocation between escort fighters and bombers.
 *
 * CAP is allocated proportionally based on escort count relative to total
 * CAP + escort count:
 *   capToEscortBp = floor(escortCount * 10_000 / max(1, escortCount + capCount))
 *   escortEngagingCap = floor(capCount * capToEscortBp / 10_000)
 *   bomberEngagingCap = capCount - escortEngagingCap
 *
 * @param capCount - Number of CAP aircraft available (SafeInt).
 * @param escortCount - Number of escort fighters (SafeInt).
 * @returns Object with escortEngagingCap and bomberEngagingCap counts.
 */
export function computeCapAllocation(
  capCount: SafeInt,
  escortCount: SafeInt,
): { escortEngagingCap: SafeInt; bomberEngagingCap: SafeInt } {
  const capN = Number(capCount);
  const escortN = Number(escortCount);

  // Edge: no CAP → all values 0
  if (capN <= 0) {
    return { escortEngagingCap: SafeInt.ZERO, bomberEngagingCap: SafeInt.ZERO };
  }

  // Edge: no escort → all CAP goes to bombers
  if (escortN <= 0) {
    return { escortEngagingCap: SafeInt.ZERO, bomberEngagingCap: capCount };
  }

  // capToEscortBp = floor(escortCount * 10_000 / max(1, escortCount + capCount))
  const total = escortN + capN;
  const capToEscortBp = Math.floor((escortN * AIR_COMBAT_BASIS_POINTS) / Math.max(1, total));

  // escortEngagingCap = floor(capCount * capToEscortBp / 10_000)
  const escortCap = Math.floor((capN * capToEscortBp) / AIR_COMBAT_BASIS_POINTS);

  // bomberEngagingCap = capCount - escortEngagingCap
  const bomberCap = Math.max(0, capN - escortCap);

  return {
    escortEngagingCap: SafeInt(escortCap),
    bomberEngagingCap: SafeInt(bomberCap),
  };
}

/**
 * Computes the disruption multiplier from CAP engagement against strike aircraft.
 *
 *   disruptionBp = max(5_000, 10_000 - floor(capEngaging * 1_000 / max(1, strikeAircraft)))
 *
 * Strong CAP relative to strike → disruption approaches 5_000 bp (50% effectiveness).
 * Weak CAP → minimal effect.
 *
 * @param capEngaging - Number of CAP aircraft engaging the strike (SafeInt).
 * @param strikeAircraft - Number of aircraft in the strike formation (SafeInt).
 * @returns Disruption value in basis points (SafeInt, 5_000-10_000).
 */
export function computeDisruption(capEngaging: SafeInt, strikeAircraft: SafeInt): SafeInt {
  const capN = Number(capEngaging);
  const strikeN = Number(strikeAircraft);

  const reduction = Math.floor((capN * 1_000) / Math.max(1, strikeN));
  const disruptionBp = Math.max(AIR_COMBAT_DISRUPTION_MIN_BP, AIR_COMBAT_BASIS_POINTS - reduction);
  return SafeInt(disruptionBp);
}
