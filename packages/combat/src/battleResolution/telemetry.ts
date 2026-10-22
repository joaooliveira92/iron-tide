export interface BattleTelemetry {
  salvosFired: number;
  roundsExpended: number;
  hits: number;
  misses: number;
  hitRateBp: number;
}

export function emptyTelemetry(): BattleTelemetry {
  return { salvosFired: 0, roundsExpended: 0, hits: 0, misses: 0, hitRateBp: 0 };
}

export function finalizeTelemetry(t: BattleTelemetry): BattleTelemetry {
  return {
    ...t,
    hitRateBp: t.salvosFired === 0 ? 0 : Math.floor((t.hits * 10_000) / t.salvosFired),
  };
}
