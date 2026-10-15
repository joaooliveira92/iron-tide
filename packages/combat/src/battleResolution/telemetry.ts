//packages/combat/src/battleResolution/telemetry.ts
// ADR-0098: observational battle telemetry for the tactical balance benchmark.
// Accumulated from the already-resolved minute surfaces (gunnery salvo records);
// no RNG, no extra draws, integer-only. OBSERVATIONAL: excluded from
// `BattleResolutionResult.resultHash` and never fed back into the simulation, so
// enabling it cannot move a pinned baseline.
export interface BattleTelemetry {
  /** Gunnery salvoes fired (one per fired battery-minute). */
  salvosFired: number;
  /** Shells expended across all fired salvoes (ammunition before - after). */
  roundsExpended: number;
  /** Salvoes that resolved HIT. */
  hits: number;
  /** Salvoes that resolved MISS. */
  misses: number;
  /** hits / salvosFired in basis points (0 when no salvo fired). */
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
