// T-1 07 (spec #109 R11, ticket #116): the enemy's decision to decline a battle with the player. Pure and integer-only:
// the ruleset's comparison on the force balance, and the way a recorded draw becomes a decision. The draw itself is made
// and recorded by the caller (the phase engine), so this module owns no randomness and no ledger.

/** The ruleset's comparison on the enemy-to-player strength ratio, in basis points. */
export type EnemyDeclineComparison = "LESS_THAN" | "LESS_OR_EQUAL";

/** A decline draw is an integer in `0 .. ENEMY_DECLINE_DRAW_RANGE_BP - 1`, compared against the probability in basis points. */
export const ENEMY_DECLINE_DRAW_RANGE_BP = 10_000;

/** The recorded reason codes of the enemy-decline draw. */
export const BATTLE_ENEMY_DECLINED = "BATTLE_ENEMY_DECLINED";
export const BATTLE_ENEMY_PROCEEDS = "BATTLE_ENEMY_PROCEEDS";

/**
 * Whether the force balance satisfies the ruleset predicate: `enemy / player` (in basis points) `comparison` threshold.
 * Evaluated by cross-multiplication in bigint, so there is no division and no rounding: the comparison is exact. A player
 * force of zero never satisfies it (there is no balance to speak of; generation's strength floors make it unreachable).
 */
export function enemyDeclinePredicateHolds(
  comparison: EnemyDeclineComparison,
  thresholdBp: number,
  enemyStrength: number,
  playerStrength: number,
): boolean {
  if (playerStrength <= 0) return false;
  const lhs = BigInt(enemyStrength) * 10_000n;
  const rhs = BigInt(thresholdBp) * BigInt(playerStrength);
  return comparison === "LESS_THAN" ? lhs < rhs : lhs <= rhs;
}

/** The enemy declines when the recorded draw falls under the ruleset probability (basis points). */
export function enemyDeclineDrawDeclines(draw: number, probabilityBp: number): boolean {
  return draw < probabilityBp;
}
