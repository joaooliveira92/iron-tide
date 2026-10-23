import type { PlayerProjection } from "@bluewave/campaign-engine";

import type { CampaignOverview } from "./campaign-shell-state.js";

export interface CommittedMonth {
  readonly closingSnapshot: {
    readonly month: CampaignOverview["month"];
    readonly revision: number;
  };
  readonly report: { readonly closingTreasury: number };
}

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
    playerNationId: projection.playerNationId,
    projectedSurplusDeficit: projection.projectedSurplusDeficit,
    atWar: projection.knownEnemyNations.length > 0,
    activeAlertsCount,
    prestige: projection.prestige,
    ...(projection.career === undefined ? {} : { career: projection.career }),
  };
}

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
    ...(previous.playerNationId !== undefined ? { playerNationId: previous.playerNationId } : {}),
    projectedSurplusDeficit: previous.projectedSurplusDeficit,
    atWar: previous.atWar,
    activeAlertsCount: null,
    prestige: previous.prestige,
    ...(previous.career === undefined ? {} : { career: previous.career }),
  };
}
