import type { PlayerProjectionEconomy, StrategicPriority } from "@bluewave/campaign-engine";

import { useRead } from "../lib/use-read.js";
import { useCampaignRevision } from "../shell/CampaignShellContext.js";
import {
  activeConstructionProjects,
  expectedConstructionCompletions,
} from "../screens/construction/construction-screen-state.js";
import { pipelineOf, type PipelineProject } from "./preTurnReviewModel.js";

export interface PreTurnReviewData {
  readonly priorities: readonly StrategicPriority[];
  readonly economy: PlayerProjectionEconomy | null;
  readonly pipeline: readonly PipelineProject[];
  readonly constructionCount: number | null;
  readonly expectedCompletions: number | null;
  readonly researchSpend: number | null;
  readonly loading: boolean;
}

const EMPTY_PRE_TURN_REVIEW: PreTurnReviewData = {
  priorities: [],
  economy: null,
  pipeline: [],
  constructionCount: null,
  expectedCompletions: null,
  researchSpend: null,
  loading: false,
};

export function usePreTurnReviewData(sessionId: string, open: boolean): PreTurnReviewData {
  const revision = useCampaignRevision();
  const options = { enabled: open };

  const campaign = useRead("inspectCampaign", sessionId, revision, options);
  const priorities = useRead("inspectPriorities", sessionId, revision, options);
  const construction = useRead("inspectConstructionScreen", sessionId, revision, options);

  if (!open) return EMPTY_PRE_TURN_REVIEW;

  const projects = construction.status === "ready" ? construction.value.projects : null;
  const economy = campaign.status === "ready" ? campaign.value.projection.economy : null;

  return {
    priorities: priorities.status === "ready" ? priorities.value.priorities : [],
    economy,
    pipeline: projects === null ? [] : pipelineOf(projects),
    constructionCount: projects === null ? null : activeConstructionProjects(projects).length,
    expectedCompletions: projects === null ? null : expectedConstructionCompletions(projects),
    researchSpend: economy === null ? null : economy.researchSpend,
    loading:
      campaign.status === "loading" ||
      priorities.status === "loading" ||
      construction.status === "loading",
  };
}
