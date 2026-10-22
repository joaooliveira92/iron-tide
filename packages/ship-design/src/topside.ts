import type { ArrangementResult, ZoneId } from "./arrangement.js";

export const TOPSIDE_WARN_BP = 8_000;
export const TOPSIDE_FULL_BP = 10_000;

export type TopsideStatus = "normal" | "warning" | "exceeded";

export interface TopsideZoneLoad {
  readonly zoneId: ZoneId;
  readonly usedMm2: number;
  readonly capacityMm2: number;
  readonly status: TopsideStatus;
}

export interface TopsideLoad {
  readonly usedMm2: number;
  readonly capacityMm2: number;
  readonly remainingMm2: number;
  readonly utilizationBp: number | null;
  readonly status: TopsideStatus;
  readonly zones: readonly TopsideZoneLoad[];
}

export function topsideStatus(usedMm2: number, capacityMm2: number): TopsideStatus {
  if (usedMm2 > capacityMm2) return "exceeded";
  if (capacityMm2 === 0) return "normal";
  return BigInt(usedMm2) * 10_000n >= BigInt(TOPSIDE_WARN_BP) * BigInt(capacityMm2)
    ? "warning"
    : "normal";
}

export function topsideLoad(arrangement: ArrangementResult | null): TopsideLoad {
  const zones = (arrangement?.zones ?? []).map((z) => ({
    zoneId: z.zoneId,
    usedMm2: z.deckUsedMm2,
    capacityMm2: z.deckCapacityMm2,
    status: topsideStatus(z.deckUsedMm2, z.deckCapacityMm2),
  }));
  const usedMm2 = zones.reduce((s, z) => s + z.usedMm2, 0);
  const capacityMm2 = zones.reduce((s, z) => s + z.capacityMm2, 0);
  return {
    usedMm2,
    capacityMm2,
    remainingMm2: capacityMm2 - usedMm2,
    utilizationBp:
      capacityMm2 === 0 ? null : Number((BigInt(usedMm2) * 10_000n) / BigInt(capacityMm2)),
    status: zones.some((z) => z.status === "exceeded")
      ? "exceeded"
      : topsideStatus(usedMm2, capacityMm2),
    zones,
  };
}
