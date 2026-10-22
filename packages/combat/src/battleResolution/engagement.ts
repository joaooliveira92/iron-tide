import { directionBp } from "../movement/kinematics.js";
import { rangeBetweenUm } from "../gunnery/rangeCurve.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import { BATTLE_ENGAGEMENT_BAND_UM, BATTLE_ENGAGEMENT_RANGE_UM } from "./constants.js";

export type EngagementSide = "ATTACKER" | "DEFENDER";

export interface RangeControllerDecision {
  controller: EngagementSide | null;
  attackerMaxDesignedSpeedUms: number;
  defenderMaxDesignedSpeedUms: number;
}

export function resolveRangeController(
  units: readonly TacticalShipUnit[],
): RangeControllerDecision {
  const maxOf = (side: EngagementSide): number => {
    let m = 0;
    for (const u of units) {
      if (u.sideId === side) m = Math.max(m, u.designedSpeedUms as number);
    }
    return m;
  };
  const attackerMax = maxOf("ATTACKER");
  const defenderMax = maxOf("DEFENDER");
  const controller: EngagementSide | null =
    attackerMax > defenderMax ? "ATTACKER" : defenderMax > attackerMax ? "DEFENDER" : null;
  return {
    controller,
    attackerMaxDesignedSpeedUms: attackerMax,
    defenderMaxDesignedSpeedUms: defenderMax,
  };
}

export function foldHeading(degrees: number): number {
  return (((degrees % 360) + 360) % 360) | 0;
}

export type EngagementManoeuvre = "CLOSE" | "HOLD" | "OPEN";

export function engagementManoeuvre(
  rangeUm: number,
  centerUm: number = BATTLE_ENGAGEMENT_RANGE_UM,
  bandUm: number = BATTLE_ENGAGEMENT_BAND_UM,
): EngagementManoeuvre {
  if (rangeUm > centerUm + bandUm) return "CLOSE";
  if (rangeUm < centerUm - bandUm) return "OPEN";
  return "HOLD";
}

export interface EngagementHeadingInput {
  rangeUm: number;
  bearingToEnemy: number;
  centerUm?: number;
  bandUm?: number;
}

export function engagementHeading(input: EngagementHeadingInput): number {
  const { rangeUm, bearingToEnemy } = input;
  return engagementManoeuvre(rangeUm, input.centerUm, input.bandUm) === "OPEN"
    ? foldHeading(bearingToEnemy + 180)
    : foldHeading(bearingToEnemy);
}

export function headingToward(dx: number, dy: number): number {
  let best = 0;
  let bestDot = Number.NEGATIVE_INFINITY;
  for (let h = 0; h < 360; h++) {
    const { cosBp, sinBp } = directionBp(h);
    const dot = dx * cosBp + dy * sinBp;
    if (dot > bestDot) {
      bestDot = dot;
      best = h;
    }
  }
  return best;
}

export { rangeBetweenUm };
