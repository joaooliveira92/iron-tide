import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Result, Schema } from "effect";
import type { MonthlyReportEntry, MonthlyReports } from "../shared/campaign-command-contract.js";
import { MonthlyReportsSchema, SessionIdPayloadSchema } from "./campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import { withSchema } from "./runtime/commandProgram.js";
import { ReportsStore } from "./runtime/sidecarStores.js";

/**
 * The per-campaign monthly-report history sidecar (spec §16 "Report history").
 * Main appends one derived `MonthlyReportEntry` per successful `commitMonth`,
 * pruning to the most recent {@link MONTHLY_REPORTS_LIMIT}; the renderer reads
 * it read-only for Overview's "Recent Developments". It is **never
 * authoritative**: it is a sibling of the campaign's save directory (not inside
 * a `SaveStore` save id), is not part of the envelope/hash, and is never read
 * by `MonthExecutor`. The filename lives next to `pointer.json`/save ids in
 * `saveDir`, so it is keyed by `campaignId` via location (one campaign save dir
 * == one sidecar).
 */
export const MONTHLY_REPORTS_FILENAME = "monthly-reports.json";

/** The most recent reports kept in the sidecar (spec §16: "most recent 12"). */
export const MONTHLY_REPORTS_LIMIT = 12;

/** Cancellation matches `SaveStore`'s convention (`error.name === "AbortError"`). */
function createAbortError(): Error {
  const error = new Error("Monthly-report write was cancelled");
  error.name = "AbortError";
  return error;
}

/** The tolerant-read fallback and the initial shape: no history yet. */
export function emptyMonthlyReports(): MonthlyReports {
  return { reports: [] };
}

/**
 * Tolerant read (acceptance: missing/corrupt -> empty, never crashes). A
 * missing file, unparseable JSON, or a shape that fails `MonthlyReportsSchema`
 * all fall back to `emptyMonthlyReports()`.
 *
 * The raw `node:*` read lives here (not in the command program): the
 * `ReportsStore` service wraps this helper, so the Effect program never
 * touches the filesystem directly. `commitMonth` still calls it directly when
 * appending a derived report, so it stays exported.
 */
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

/**
 * Atomic write (tmp file -> rename, matching `SaveStore.save`'s pointer
 * publish / ENGINEERING-CONTRACT "Save atomically"): the final
 * `monthly-reports.json` path is never left partially written, and a failed
 * write removes the tmp artifact. Cancellation is checked before any fs work;
 * unlike an authoritative save there is no pointer to advance (this is
 * app-owned history, not a campaign save).
 *
 * `commitMonth` calls this directly to append a derived report; the
 * `ReportsStore` service wraps the same helper. It stays exported.
 */
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

/** Prepend the newest report and prune to the limit (spec §16). */
export function appendMonthlyReport(
  data: MonthlyReports,
  report: MonthlyReportEntry,
): MonthlyReports {
  return { reports: [report, ...data.reports].slice(0, MONTHLY_REPORTS_LIMIT) };
}

/**
 * `readMonthlyReports(sessionId) -> { reports }` as an Effect command program
 * (ADR-0159). Reads the session's sidecar through `ReportsStore`, tolerantly
 * (missing/corrupt -> empty). The renderer renders the returned entries
 * read-only; main is the only writer. The session is resolved through
 * `CampaignSessionStore`, whose `SessionNotFound` failure projects to the same
 * `SESSION_NOT_FOUND` envelope as before.
 */
export const readMonthlyReportsProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const reports = yield* ReportsStore;
    const data = yield* reports.load(record.saveDir);

    return { outcome: "success" as const, value: { reports: data.reports }, diagnostics: [] };
  }),
);
