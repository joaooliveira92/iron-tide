import type { MonthlyReportEntry } from "../../../shared/reports-contract.js";
import { useRead } from "../../lib/use-read.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export interface MonthlyReportsState {
  readonly reports: readonly MonthlyReportEntry[];
  readonly loading: boolean;
}

const EMPTY_REPORTS: readonly MonthlyReportEntry[] = [];

export function useMonthlyReports(sessionId: string): MonthlyReportsState {
  const read = useRead("readMonthlyReports", sessionId, useCampaignRevision());

  if (read.status === "ready") {
    const reports = Array.isArray(read.value.reports) ? read.value.reports : EMPTY_REPORTS;
    return { reports, loading: false };
  }
  return { reports: EMPTY_REPORTS, loading: read.status === "loading" };
}
