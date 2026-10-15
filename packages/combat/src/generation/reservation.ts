import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_ASSET_RESERVATION_CONFLICT } from "./reasonCodes.js";

// DESIGN-37 §41: shipped maximum participation per persistent ship per month is exactly 1.
export const MAX_BATTLE_PARTICIPATION_PER_SHIP_PER_MONTH = 1;

export interface Reservation {
  battleId: string;
  assetId: string;
  reservationId: string;
}

// Reserve every participating persistent asset; duplicate -> BATTLE_ASSET_RESERVATION_CONFLICT.
export function reserveAssets(
  battleId: string,
  assetIds: string[],
  alreadyReserved: ReadonlySet<string>,
  context?: Record<string, unknown>,
): Reservation[] {
  const reservations: Reservation[] = [];
  const seen = new Set<string>();
  for (const assetId of assetIds) {
    if (alreadyReserved.has(assetId) || seen.has(assetId)) {
      throw new BluewaveError(BATTLE_ASSET_RESERVATION_CONFLICT, {
        code: BATTLE_ASSET_RESERVATION_CONFLICT,
        assetId,
        battleId,
        ...context,
      });
    }
    seen.add(assetId);
    reservations.push({ battleId, assetId, reservationId: `${battleId}:${assetId}` });
  }
  return reservations;
}

export function releaseProvisionalReservations(
  reservations: Reservation[],
  releaseIds: ReadonlySet<string>,
): Reservation[] {
  return reservations.filter((r) => !releaseIds.has(r.assetId));
}

export function assertParticipationLimit(
  perShipMonthlyCount: Record<string, number>,
  context?: Record<string, unknown>,
): void {
  for (const [assetId, count] of Object.entries(perShipMonthlyCount)) {
    if (count > MAX_BATTLE_PARTICIPATION_PER_SHIP_PER_MONTH) {
      throw new BluewaveError(BATTLE_ASSET_RESERVATION_CONFLICT, {
        code: BATTLE_ASSET_RESERVATION_CONFLICT,
        assetId,
        count,
        max: MAX_BATTLE_PARTICIPATION_PER_SHIP_PER_MONTH,
        ...context,
      });
    }
  }
}
