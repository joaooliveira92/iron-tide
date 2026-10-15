import type { ArrangementResult, ZoneId } from "./arrangement.js";

/**
 * Topside load: how much of the ship's usable deck area is occupied by placed fittings (guns, directors, boats,
 * superstructure items). It is the deck-area use the arrangement model already tracks per zone, summed over the
 * ship; it is NOT an abstract points score. Integer maths only (mm², basis points).
 *
 * Provisional thresholds (named, not magic): there is no sourced rule for a "crowded deck" warning, so the
 * WARNING band starts at 80 % of capacity. Replace with a sourced value when research supplies one.
 */
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
  /** capacity - used; negative when exceeded. */
  readonly remainingMm2: number;
  /** used / capacity in basis points (10_000 = 100 %); null when capacity is zero. */
  readonly utilizationBp: number | null;
  readonly status: TopsideStatus;
  readonly zones: readonly TopsideZoneLoad[];
}

export function topsideStatus(usedMm2: number, capacityMm2: number): TopsideStatus {
  if (usedMm2 > capacityMm2) return "exceeded";
  if (capacityMm2 === 0) return "normal"; // used is 0 here
  // used * 10_000 >= warn * capacity, in integers
  return BigInt(usedMm2) * 10_000n >= BigInt(TOPSIDE_WARN_BP) * BigInt(capacityMm2)
    ? "warning"
    : "normal";
}

/** Pure: same arrangement, same result. Null arrangement (nothing compiled) is an empty, normal load. */
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
    // The ship is exceeded when any zone is: deck area cannot be moved between zones.
    status: zones.some((z) => z.status === "exceeded")
      ? "exceeded"
      : topsideStatus(usedMm2, capacityMm2),
    zones,
  };
}
