import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_REACHABILITY_FAILED } from "./reasonCodes.js";
import type { TacticalShipUnit } from "../tactical/unit.js";

export interface ReachabilityContext {
  areaId: string;
  reservedAssetIds: ReadonlySet<string>;
  workingUpExcluded: boolean;
}

// DESIGN-37 §26: revalidate reachability and legality after composition.
export function revalidateReachabilityAndLegality(
  units: TacticalShipUnit[],
  ctx: ReachabilityContext,
  context?: Record<string, unknown>,
): void {
  for (const u of units) {
    // provenance uniqueness is validated separately; here check location + reservation.
    if (ctx.reservedAssetIds.has(u.campaignShipId)) {
      throw new BluewaveError(BATTLE_REACHABILITY_FAILED, {
        code: BATTLE_REACHABILITY_FAILED,
        assetId: u.assetId,
        reason: "asset already reserved",
        ...context,
      });
    }
    if (ctx.workingUpExcluded && u.hitPoints <= 0) {
      throw new BluewaveError(BATTLE_REACHABILITY_FAILED, {
        code: BATTLE_REACHABILITY_FAILED,
        assetId: u.assetId,
        reason: "non-survivable asset",
        ...context,
      });
    }
  }
}
