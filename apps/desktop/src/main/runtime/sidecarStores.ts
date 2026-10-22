import { Context, Effect, Layer } from "effect";
import {
  loadDrawingBoardDraft,
  removeDrawingBoardDraft,
  saveDrawingBoardDraft,
} from "../drawingBoardDraft.js";
import { appendMonthlyReport, loadMonthlyReports, saveMonthlyReports } from "../monthlyReports.js";
import { appendTurnSummary, loadTurnSummaries, saveTurnSummaries } from "../turnSummaries.js";
import type { MonthlyReportEntry, MonthlyReports } from "../../shared/reports-contract.js";
import type { TurnSummaries, TurnSummaryEntry } from "../../shared/turn-message-contract.js";
import type { UiState } from "../../shared/ui-state-contract.js";
import type {
  DrawingBoardDraftRecord,
  WriteDrawingBoardDraftPayload,
} from "../../shared/design-contract.js";
import { loadUiState, saveUiState } from "../uiState.js";
import { CommandFailed } from "./commandError.js";

function failure(reason: string, error: unknown): CommandFailed {
  return new CommandFailed({
    reason,
    diagnostics: [error instanceof Error ? error.message : String(error)],
  });
}

export class UiStateStore extends Context.Service<
  UiStateStore,
  {
    readonly load: (saveDir: string, turn: number) => Effect.Effect<UiState, CommandFailed>;
    readonly save: (saveDir: string, uiState: UiState) => Effect.Effect<void, CommandFailed>;
  }
>()("bluewave/desktop/UiStateStore") {}

export class ReportsStore extends Context.Service<
  ReportsStore,
  {
    readonly load: (saveDir: string) => Effect.Effect<MonthlyReports, CommandFailed>;
    readonly save: (saveDir: string, data: MonthlyReports) => Effect.Effect<void, CommandFailed>;
    readonly append: (
      data: MonthlyReports,
      report: MonthlyReportEntry,
    ) => Effect.Effect<MonthlyReports>;
  }
>()("bluewave/desktop/ReportsStore") {}

export class TurnSummariesStore extends Context.Service<
  TurnSummariesStore,
  {
    readonly load: (saveDir: string) => Effect.Effect<TurnSummaries, CommandFailed>;
    readonly save: (saveDir: string, data: TurnSummaries) => Effect.Effect<void, CommandFailed>;
    readonly append: (
      data: TurnSummaries,
      summary: TurnSummaryEntry,
    ) => Effect.Effect<TurnSummaries>;
  }
>()("bluewave/desktop/TurnSummariesStore") {}

export class DraftStore extends Context.Service<
  DraftStore,
  {
    readonly load: (
      saveDir: string,
    ) => Effect.Effect<DrawingBoardDraftRecord | null, CommandFailed>;
    readonly save: (
      saveDir: string,
      draft: NonNullable<WriteDrawingBoardDraftPayload["draft"]>,
      savedAt: string,
    ) => Effect.Effect<void, CommandFailed>;
    readonly remove: (saveDir: string) => Effect.Effect<void, CommandFailed>;
  }
>()("bluewave/desktop/DraftStore") {}

function attempt<A>(reason: string, run: () => A): Effect.Effect<A, CommandFailed> {
  return Effect.try({ try: run, catch: (e) => failure(reason, e) });
}

export function sidecarStoresLayer(): Layer.Layer<
  UiStateStore | ReportsStore | DraftStore | TurnSummariesStore
> {
  return Layer.mergeAll(
    Layer.succeed(UiStateStore, {
      load: (saveDir, turn) => attempt("UI_STATE_READ_FAILED", () => loadUiState(saveDir, turn)),
      save: (saveDir, uiState) =>
        attempt("UI_STATE_WRITE_FAILED", () => saveUiState(saveDir, uiState)),
    }),
    Layer.succeed(ReportsStore, {
      load: (saveDir) => attempt("REPORTS_READ_FAILED", () => loadMonthlyReports(saveDir)),
      save: (saveDir, data) =>
        attempt("REPORTS_WRITE_FAILED", () => saveMonthlyReports(saveDir, data)),
      append: (data, report) => Effect.succeed(appendMonthlyReport(data, report)),
    }),
    Layer.succeed(TurnSummariesStore, {
      load: (saveDir) => attempt("TURN_SUMMARIES_READ_FAILED", () => loadTurnSummaries(saveDir)),
      save: (saveDir, data) =>
        attempt("TURN_SUMMARIES_WRITE_FAILED", () => saveTurnSummaries(saveDir, data)),
      append: (data, summary) => Effect.succeed(appendTurnSummary(data, summary)),
    }),
    Layer.succeed(DraftStore, {
      load: (saveDir) => attempt("DRAFT_READ_FAILED", () => loadDrawingBoardDraft(saveDir)),
      save: (saveDir, draft, savedAt) =>
        attempt("DRAFT_WRITE_FAILED", () => saveDrawingBoardDraft(saveDir, draft, savedAt)),
      remove: (saveDir) => attempt("DRAFT_WRITE_FAILED", () => removeDrawingBoardDraft(saveDir)),
    }),
  );
}
