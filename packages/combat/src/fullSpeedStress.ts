import type { RandomEngine } from "@bluewave/random";

export const FULL_SPEED_STRESS_BP = 9_500 as const;
export const SHIPPED_BASE_PROBABILITIES = {
  fouledGratesCoal: 500,
  exhaustedStokersCoal: 750,
  machineryBreakdown: 250,
  vibrationAbove25kts: 1_000,
} as const;

export function isFullSpeedStress(orderedSpeed: number, attainableMax: number): boolean {
  if (attainableMax <= 0) return false;
  return orderedSpeed * 10_000 >= 9_500 * attainableMax;
}
export function evaluateStress(opts: {
  shipId: string;
  battleId: string;
  orderedSpeed: number;
  attainableMax: number;
  speedKnots: number;
  isCoalFired: boolean;
  isVTE: boolean;
  minutesAtFullStress: number;
  engine: RandomEngine;
}): string[] {
  const events: string[] = [];
  if (!isFullSpeedStress(opts.orderedSpeed, opts.attainableMax)) return events;
  const checks = Math.floor(opts.minutesAtFullStress / 10);
  for (let i = 1; i <= checks; i++) {
    const stream = opts.engine.stream(
      `battle/ship/propulsion/full_speed_stress:${opts.battleId}:${opts.shipId}:${i}`,
    );
    const roll = Math.floor(stream.next() * 10_000);
    let prob = 0;
    prob = 250;
    if (opts.isVTE) prob = Math.min(10_000, Math.floor((prob * 15_000) / 10_000));
    if (opts.speedKnots > 25) prob += 1_000 * (opts.isVTE ? 15_000 / 10_000 : 1);
    if (roll < prob) events.push("machinery_breakdown");
  }
  return events;
}
