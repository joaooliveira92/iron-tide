import type {
  MonthlyReportEntry,
  ReadMonthlyReportsResult,
} from "../../../shared/reports-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { useBridgeQuery } from "../../lib/use-bridge-query.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export interface MonthlyReportsState {
  readonly reports: readonly MonthlyReportEntry[];
  readonly loading: boolean;
}

const EMPTY_REPORTS: readonly MonthlyReportEntry[] = [];

export function useMonthlyReports(sessionId: string): MonthlyReportsState {
  const revision = useCampaignRevision();
  const state = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id): Promise<BridgeResult<ReadMonthlyReportsResult>> =>
      bridge.campaign.execute("readMonthlyReports", id),
  );

  if (state.status === "ready") {
    const reports = Array.isArray(state.value.reports) ? state.value.reports : EMPTY_REPORTS;
    return { reports, loading: false };
  }
  return { reports: EMPTY_REPORTS, loading: state.status === "loading" };
}
