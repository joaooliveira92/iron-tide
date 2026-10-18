/** Words for the engine-priority axis, -10_000 (reliability) .. +10_000 (speed), 0 = balanced (ADR-0233). */
export function enginePriorityTrade(priorityBp: number): string {
  if (priorityBp === 0) return "Balanced: no speed or reliability trade.";
  const percent = Math.round(Math.abs(priorityBp) / 100);
  return priorityBp > 0
    ? `${percent}% toward speed: a lighter plant that delivers more power, but breaks down more often.`
    : `${percent}% toward reliability: a heavier plant that breaks down less often, but delivers less power.`;
}
