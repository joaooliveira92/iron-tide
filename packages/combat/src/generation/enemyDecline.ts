export type EnemyDeclineComparison = "LESS_THAN" | "LESS_OR_EQUAL";

export const ENEMY_DECLINE_DRAW_RANGE_BP = 10_000;

export const BATTLE_ENEMY_DECLINED = "BATTLE_ENEMY_DECLINED";
export const BATTLE_ENEMY_PROCEEDS = "BATTLE_ENEMY_PROCEEDS";

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

export function enemyDeclineDrawDeclines(draw: number, probabilityBp: number): boolean {
  return draw < probabilityBp;
}
