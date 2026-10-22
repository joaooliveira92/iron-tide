import { Effect } from "effect";
import type { MonthlyReportEntry, MonthlyReports } from "../shared/campaign-command-contract.js";
import { MonthlyReportsSchema } from "../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import type { CommandHandler } from "./runtime/commandProgram.js";
import { defineSidecar, prependBounded } from "./runtime/sidecar.js";
import { ReportsStore } from "./runtime/sidecarStores.js";

export const MONTHLY_REPORTS_FILENAME = "monthly-reports.json";

export const MONTHLY_REPORTS_LIMIT = 12;

const sidecar = defineSidecar<MonthlyReports, MonthlyReports>({
  filename: MONTHLY_REPORTS_FILENAME,
  schema: MonthlyReportsSchema,
  space: 2,
  empty: emptyMonthlyReports,
  resolve: (stored) => stored,
});

export function emptyMonthlyReports(): MonthlyReports {
  return { reports: [] };
}

export function loadMonthlyReports(saveDir: string): MonthlyReports {
  return sidecar.read(saveDir, undefined);
}

export function saveMonthlyReports(
  saveDir: string,
  data: MonthlyReports,
  signal?: AbortSignal,
): void {
  sidecar.write(saveDir, data, signal);
}

export function appendMonthlyReport(
  data: MonthlyReports,
  report: MonthlyReportEntry,
): MonthlyReports {
  return {
    reports: prependBounded(data.reports, report, MONTHLY_REPORTS_LIMIT),
  };
}

export const readMonthlyReportsProgram: CommandHandler<"readMonthlyReports"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const reports = yield* ReportsStore;
    const data = yield* reports.load(record.saveDir);

    return { outcome: "success" as const, value: { reports: data.reports }, diagnostics: [] };
  });
