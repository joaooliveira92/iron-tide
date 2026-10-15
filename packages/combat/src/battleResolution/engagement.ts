// P-1 ticket 11 / ADR-0072: speed advantage as range control.
//
// The pre-ticket-11 resolver let every ship steer straight at the nearest enemy
// at full designed speed, so speed conferred no tactical advantage and a slower
// fleet beaten 30 kn to 14 kn still won (ADR-0053 sweep: 14 kn won 30/30).
// ADR-0072 models the missing decision: the side with the greater maximum
// designed speed over its committed force is the RANGE CONTROLLER. The
// controller steers standoff — it dictates the engagement band
// (CLOSE/OPEN/HOLD via `engagementHeading`) — while the contesting side is
// DENIED the range initiative: it still charges straight under ADR-0046 pursuit
// and never manœuvres of its own.
//
// That denial is priced by an explicitly versioned BALANCE TARGET (like the
// ADR-0053 lethality constants): the contesting side's DESIGN-39 §3
// `ownManeuver` accuracy factor is multiplied to `RANGE_CONTEST_OWN_MANEUVER_BP`
// (see constants.ts). The value represents the fire-control cost of contesting
// the engagement without the range initiative; it is NOT an emergent result of
// manoeuvring the contesting side performs — the side performs none. No new
// accuracy factor key and no GUNNERY_RULESET_VERSION bump is required. Equal
// maximum speeds (including an absent/empty side) are deliberately neutral:
// `resolveRangeController` returns null, the contest penalty is NOT applied, and
// steering stays ADR-0046 pursuit — so equal-speed matchups and the P-1 torpedo
// doctrine (whose lead/intercept courses assume the ADR-0046 closing geometry)
// are byte-identical.
import { directionBp } from "../movement/kinematics.js";
import { rangeBetweenUm } from "../gunnery/rangeCurve.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import { BATTLE_ENGAGEMENT_BAND_UM, BATTLE_ENGAGEMENT_RANGE_UM } from "./constants.js";

export type EngagementSide = "ATTACKER" | "DEFENDER";

export interface RangeControllerDecision {
  /** The side that controls the range, or null when maximum speeds are equal. */
  controller: EngagementSide | null;
  attackerMaxDesignedSpeedUms: number;
  defenderMaxDesignedSpeedUms: number;
}

/**
 * The side with the greater maximum designed speed over its committed force
 * controls the range. `designedSpeedUms` is a fixed design attribute and the
 * unit array is constant for the battle (sunk ships stay in it with
 * `terminalStatus`), so this is evaluated over the whole committed force, fixed
 * at battle start, and constant throughout — the projection-time penalty and
 * the per-minute steering decision always agree on the controller identity.
 * Ties (including an empty/absent side) are neutral: `controller` is null and
 * neither side is penalised nor steers differently.
 */
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

/** Fold any integer degree value into [0, 359]. */
export function foldHeading(degrees: number): number {
  return (((degrees % 360) + 360) % 360) | 0;
}

export type EngagementManoeuvre = "CLOSE" | "HOLD" | "OPEN";

/**
 * Branch of the standoff law for the range controller, from the current range to
 * the nearest enemy:
 *  - range > centre + band: CLOSE at the enemy;
 *  - range < centre - band: OPEN directly away (never pass through);
 *  - otherwise: HOLD — keep steering at the enemy (gently closing) while inside
 *    the band. Together with the OPEN branch this tracks the band (bounce off
 *    the lower edge while otherwise closing); it is not a literal station-keeping
 *    hold.
 */
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

/**
 * Ordered heading of the range controller under the standoff law. Inside the
 * band the HOLD branch keeps bearing at the enemy (gently closing), so the band
 * is tracked via the CLOSE/OPEN corrections rather than held as a stationary
 * position. The law is deliberately reflection-symmetric (CLOSE mirrors to
 * CLOSE, OPEN to OPEN under the centre reflection), so it introduces no
 * attacker/defender bias of its own.
 */
export function engagementHeading(input: EngagementHeadingInput): number {
  const { rangeUm, bearingToEnemy } = input;
  return engagementManoeuvre(rangeUm, input.centerUm, input.bandUm) === "OPEN"
    ? foldHeading(bearingToEnemy + 180)
    : foldHeading(bearingToEnemy);
}

/** Integer heading (0..359, movement convention) whose unit vector best aligns
 *  with (dx, dy). Kept here so peer modules share one authored direction-table
 *  search (no duplicated table, no floating trigonometry). */
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
