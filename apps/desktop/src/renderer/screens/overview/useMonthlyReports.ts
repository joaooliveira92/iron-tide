import type {
  MonthlyReportEntry,
  ReadMonthlyReportsResult,
} from "../../../shared/campaign-command-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { useBridgeQuery } from "../../lib/use-bridge-query.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export interface MonthlyReportsState {
  /** The stored reports, newest first (empty while loading or when none exist). */
  readonly reports: readonly MonthlyReportEntry[];
  readonly loading: boolean;
}

const EMPTY_REPORTS: readonly MonthlyReportEntry[] = [];

/**
 * Reads the per-campaign `monthly-reports.json` sidecar read-only (spec §16
 * "Report history"), through the shared `useBridgeQuery` convention. Reloads
 * when the campaign revision changes — i.e. after the campaign is opened and
 * after each month commit — so Overview's "Recent Developments" always shows
 * the sidecar, never a renderer-local copy. A failed/unavailable read degrades
 * to an empty history rather than inventing one.
 */
export function useMonthlyReports(sessionId: string): MonthlyReportsState {
  const revision = useCampaignRevision();
  const state = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id): Promise<BridgeResult<ReadMonthlyReportsResult>> =>
      bridge.campaign.execute("readMonthlyReports", id),
  );

  if (state.status === "ready") {
    // `reports` is guarded against a bridge double that answers with a
    // different command's shape (tests); a real response always carries it.
    const reports = Array.isArray(state.value.reports) ? state.value.reports : EMPTY_REPORTS;
    return { reports, loading: false };
  }
  return { reports: EMPTY_REPORTS, loading: state.status === "loading" };
}
