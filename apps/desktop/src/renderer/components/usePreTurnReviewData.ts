import type { StrategicPriority } from "@bluewave/campaign-engine";

import { useBridgeQuery } from "../lib/use-bridge-query.js";
import { useCampaignRevision } from "../shell/CampaignShellContext.js";
import {
  activeConstructionProjects,
  expectedConstructionCompletions,
} from "../screens/construction/construction-screen-state.js";

export interface PreTurnReviewData {
  readonly priorities: readonly StrategicPriority[];
  readonly constructionCount: number | null;
  readonly expectedCompletions: number | null;
  readonly researchSpend: number | null;
  readonly loading: boolean;
}

const EMPTY_PRE_TURN_REVIEW: PreTurnReviewData = {
  priorities: [],
  constructionCount: null,
  expectedCompletions: null,
  researchSpend: null,
  loading: false,
};

export function usePreTurnReviewData(sessionId: string, open: boolean): PreTurnReviewData {
  const revision = useCampaignRevision();
  const options = { enabled: open };

  const campaign = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id) => bridge.campaign.execute("inspectCampaign", id),
    options,
  );
  const priorities = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id) => bridge.campaign.execute("inspectPriorities", id),
    options,
  );
  const construction = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id) => bridge.campaign.execute("inspectConstructionScreen", id),
    options,
  );

  if (!open) return EMPTY_PRE_TURN_REVIEW;

  const projects = construction.status === "ready" ? construction.value.projects : null;

  return {
    priorities: priorities.status === "ready" ? priorities.value.priorities : [],
    constructionCount: projects === null ? null : activeConstructionProjects(projects).length,
    expectedCompletions: projects === null ? null : expectedConstructionCompletions(projects),
    researchSpend:
      campaign.status === "ready" ? campaign.value.projection.economy.researchSpend : null,
    loading:
      campaign.status === "loading" ||
      priorities.status === "loading" ||
      construction.status === "loading",
  };
}
