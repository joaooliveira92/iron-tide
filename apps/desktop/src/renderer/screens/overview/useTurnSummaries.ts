import type {
  ReadTurnSummariesResult,
  TurnSummaryEntry,
} from "../../../shared/campaign-command-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { useBridgeQuery } from "../../lib/use-bridge-query.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export interface TurnSummariesState {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
}

const EMPTY: readonly TurnSummaryEntry[] = [];

export function useTurnSummaries(sessionId: string): TurnSummariesState {
  const revision = useCampaignRevision();
  const state = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id): Promise<BridgeResult<ReadTurnSummariesResult>> =>
      bridge.campaign.execute("readTurnSummaries", id),
  );

  if (state.status === "ready") {
    const summaries = Array.isArray(state.value.summaries) ? state.value.summaries : EMPTY;
    return { summaries, loading: false };
  }
  return { summaries: EMPTY, loading: state.status === "loading" };
}
