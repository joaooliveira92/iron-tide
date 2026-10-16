import type {
  ReadTurnSummariesResult,
  TurnSummaryEntry,
} from "../../../shared/campaign-command-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { useBridgeQuery } from "../../lib/use-bridge-query.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export interface TurnSummariesState {
  /** The stored turn summaries, newest first (empty while loading or when none exist). */
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
}

const EMPTY: readonly TurnSummaryEntry[] = [];

/**
 * Reads the per-campaign `turn-summaries.json` sidecar read-only through the
 * shared `useBridgeQuery` convention, reloading when the campaign revision
 * changes (after the campaign opens and after each turn). A failed/unavailable
 * read degrades to an empty history rather than inventing one.
 */
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
