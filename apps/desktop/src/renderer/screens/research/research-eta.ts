export function monthsToCompletion(
  cost: number,
  investedPoints: number,
  pointsPerMonth: number,
): number | null {
  if (pointsPerMonth <= 0) return null;
  const remaining = Math.max(0, cost - investedPoints);
  return Math.ceil(remaining / pointsPerMonth);
}
