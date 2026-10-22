import { SafeInt } from "@bluewave/contracts";
import { AIR_COMBAT_BASIS_POINTS, AIR_COMBAT_DISRUPTION_MIN_BP } from "./constants.js";

export function computeCapAllocation(
  capCount: SafeInt,
  escortCount: SafeInt,
): { escortEngagingCap: SafeInt; bomberEngagingCap: SafeInt } {
  const capN = Number(capCount);
  const escortN = Number(escortCount);

  if (capN <= 0) {
    return { escortEngagingCap: SafeInt.ZERO, bomberEngagingCap: SafeInt.ZERO };
  }

  if (escortN <= 0) {
    return { escortEngagingCap: SafeInt.ZERO, bomberEngagingCap: capCount };
  }

  const total = escortN + capN;
  const capToEscortBp = Math.floor((escortN * AIR_COMBAT_BASIS_POINTS) / Math.max(1, total));

  const escortCap = Math.floor((capN * capToEscortBp) / AIR_COMBAT_BASIS_POINTS);

  const bomberCap = Math.max(0, capN - escortCap);

  return {
    escortEngagingCap: SafeInt(escortCap),
    bomberEngagingCap: SafeInt(bomberCap),
  };
}

export function computeDisruption(capEngaging: SafeInt, strikeAircraft: SafeInt): SafeInt {
  const capN = Number(capEngaging);
  const strikeN = Number(strikeAircraft);

  const reduction = Math.floor((capN * 1_000) / Math.max(1, strikeN));
  const disruptionBp = Math.max(AIR_COMBAT_DISRUPTION_MIN_BP, AIR_COMBAT_BASIS_POINTS - reduction);
  return SafeInt(disruptionBp);
}
