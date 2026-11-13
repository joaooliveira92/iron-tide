import type { TurnSummaryEntry } from "../../../shared/turn-message-contract.js";
import { useRead } from "../../lib/use-read.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export interface TurnSummariesState {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly entityLabels: Readonly<Record<string, string>>;
  readonly loading: boolean;
}

const EMPTY: readonly TurnSummaryEntry[] = [];
const NO_LABELS: Readonly<Record<string, string>> = {};

export function useTurnSummaries(sessionId: string): TurnSummariesState {
  const read = useRead("readTurnSummaries", sessionId, useCampaignRevision());

  if (read.status === "ready") {
    const summaries = Array.isArray(read.value.summaries) ? read.value.summaries : EMPTY;
    return { summaries, entityLabels: read.value.entityLabels ?? NO_LABELS, loading: false };
  }
  return { summaries: EMPTY, entityLabels: NO_LABELS, loading: read.status === "loading" };
}
