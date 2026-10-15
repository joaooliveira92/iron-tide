import type { PlayerProjection } from "@bluewave/campaign-engine";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { countActiveAlerts } from "../lib/priorities.js";
import type { CampaignOverview } from "./campaign-shell-state.js";

/** The shape of a committed month the header needs, kept structural to avoid
 * coupling this helper to the full engine response type. */
export interface CommittedMonth {
  readonly closingSnapshot: {
    readonly month: CampaignOverview["month"];
    readonly revision: number;
  };
  readonly report: { readonly closingTreasury: number };
}

/** Builds the shell's campaign summary from an `inspectCampaign` projection. */
export function overviewFromProjection(
  sessionId: string,
  projection: PlayerProjection,
  activeAlertsCount: number | null,
): CampaignOverview {
  return {
    month: projection.month,
    treasury: projection.economy.treasury,
    revision: projection.revision,
    sessionId,
    nationName: projection.nationName,
    projectedSurplusDeficit: projection.projectedSurplusDeficit,
    atWar: projection.knownEnemyNations.length > 0,
    // Real count from the engine's priorities projection; null only when that
    // projection could not be read, so the header omits the slot rather than
    // showing a made-up number.
    activeAlertsCount,
  };
}

/**
 * The header summary right after a month commit, before the next
 * `inspectCampaign` refresh lands. The commit response carries no projection
 * surface (no nationName/projectedSurplusDeficit), so the shell keeps the
 * stable nation identity and last-known projected balance; the refresh fills
 * those in (and the alert count) shortly after.
 */
export function overviewAfterCommit(
  previous: CampaignOverview,
  committed: CommittedMonth,
  sessionId: string,
): CampaignOverview {
  return {
    month: committed.closingSnapshot.month,
    treasury: committed.report.closingTreasury,
    revision: committed.closingSnapshot.revision,
    sessionId,
    nationName: previous.nationName,
    projectedSurplusDeficit: previous.projectedSurplusDeficit,
    atWar: previous.atWar,
    // Last month's count would be wrong for this month; the refresh below fills it in.
    activeAlertsCount: null,
  };
}

/** The number of warnings/criticals the engine reports, or null if unavailable. */
export async function loadActiveAlertsCount(
  bridge: BluewaveDesktopBridge,
  sessionId: string,
): Promise<number | null> {
  try {
    const result = await bridge.campaign.execute("inspectPriorities", sessionId);
    return result.outcome === "success" ? countActiveAlerts(result.value.priorities) : null;
  } catch {
    return null;
  }
}
