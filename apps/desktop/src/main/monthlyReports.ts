import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Result, Schema } from "effect";
import type { MonthlyReportEntry, MonthlyReports } from "../shared/campaign-command-contract.js";
import { MonthlyReportsSchema } from "../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import type { CommandHandler } from "./runtime/commandProgram.js";
import { ReportsStore } from "./runtime/sidecarStores.js";

export const MONTHLY_REPORTS_FILENAME = "monthly-reports.json";

export const MONTHLY_REPORTS_LIMIT = 12;

function createAbortError(): Error {
  const error = new Error("Monthly-report write was cancelled");
  error.name = "AbortError";
  return error;
}

export function emptyMonthlyReports(): MonthlyReports {
  return { reports: [] };
}

export function loadMonthlyReports(saveDir: string): MonthlyReports {
  const path = join(saveDir, MONTHLY_REPORTS_FILENAME);
  if (!existsSync(path)) {
    return emptyMonthlyReports();
  }
  try {
    const parsed = Schema.decodeUnknownResult(MonthlyReportsSchema)(
      JSON.parse(readFileSync(path, "utf8")),
    );
    if (Result.isFailure(parsed)) {
      return emptyMonthlyReports();
    }
    return parsed.success;
  } catch {
    return emptyMonthlyReports();
  }
}

export function saveMonthlyReports(
  saveDir: string,
  data: MonthlyReports,
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const path = join(saveDir, MONTHLY_REPORTS_FILENAME);
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmpPath, path);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
  }
}

export function appendMonthlyReport(
  data: MonthlyReports,
  report: MonthlyReportEntry,
): MonthlyReports {
  return { reports: [report, ...data.reports].slice(0, MONTHLY_REPORTS_LIMIT) };
}

export const readMonthlyReportsProgram: CommandHandler<"readMonthlyReports"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const reports = yield* ReportsStore;
    const data = yield* reports.load(record.saveDir);

    return { outcome: "success" as const, value: { reports: data.reports }, diagnostics: [] };
  });
