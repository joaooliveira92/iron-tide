// The three renderer-owned, non-authoritative sidecars as services (INC-4;
// ADR-0159): UI state, monthly-report history, and the drawing-board draft.
// Each is a sibling of the save ids in the campaign save directory, outside the
// envelope and hash. Raw `node:*` stays inside the service.
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { Context, Effect, Layer } from "effect";
import { DRAWING_BOARD_DRAFT_FILENAME, loadDrawingBoardDraft } from "../drawingBoardDraft.js";
import { MONTHLY_REPORTS_FILENAME, loadMonthlyReports } from "../monthlyReports.js";
import type {
  MonthlyReportEntry,
  MonthlyReports,
  UiState,
} from "../../shared/campaign-command-contract.js";
import type {
  DrawingBoardDraftRecord,
  WriteDrawingBoardDraftPayload,
} from "../../shared/design-contract.js";
import { UI_STATE_FILENAME, loadUiState } from "../uiState.js";
import { CommandFailed } from "./commandError.js";

function failure(reason: string, error: unknown): CommandFailed {
  return new CommandFailed({
    reason,
    diagnostics: [error instanceof Error ? error.message : String(error)],
  });
}

function atomicWrite(path: string, contents: string): void {
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, contents, "utf8");
    renameSync(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
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

export function sidecarStoresLayer(): Layer.Layer<UiStateStore | ReportsStore | DraftStore> {
  return Layer.mergeAll(
    Layer.succeed(UiStateStore, {
      load: (saveDir, turn) =>
        Effect.try({
          try: () => loadUiState(saveDir, turn),
          catch: (e) => failure("UI_STATE_READ_FAILED", e),
        }),
      save: (saveDir, uiState) =>
        Effect.try({
          try: () =>
            atomicWrite(join(saveDir, UI_STATE_FILENAME), JSON.stringify(uiState, null, 2)),
          catch: (e) => failure("UI_STATE_WRITE_FAILED", e),
        }),
    }),
    Layer.succeed(ReportsStore, {
      load: (saveDir) =>
        Effect.try({
          try: () => loadMonthlyReports(saveDir),
          catch: (e) => failure("REPORTS_READ_FAILED", e),
        }),
      save: (saveDir, data) =>
        Effect.try({
          try: () =>
            atomicWrite(join(saveDir, MONTHLY_REPORTS_FILENAME), JSON.stringify(data, null, 2)),
          catch: (e) => failure("REPORTS_WRITE_FAILED", e),
        }),
      append: (data, report) => Effect.succeed({ reports: [report, ...data.reports].slice(0, 12) }),
    }),
    Layer.succeed(DraftStore, {
      load: (saveDir) =>
        Effect.try({
          try: () => loadDrawingBoardDraft(saveDir),
          catch: (e) => failure("DRAFT_READ_FAILED", e),
        }),
      save: (saveDir, draft, savedAt) =>
        Effect.try({
          try: () =>
            atomicWrite(
              join(saveDir, DRAWING_BOARD_DRAFT_FILENAME),
              JSON.stringify({
                schema: "drawing_board_draft_v1",
                savedAt,
                presetId: draft.presetId,
                log: draft.log,
                compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
              }),
            ),
          catch: (e) => failure("DRAFT_WRITE_FAILED", e),
        }),
      remove: (saveDir) =>
        Effect.try({
          try: () => rmSync(join(saveDir, DRAWING_BOARD_DRAFT_FILENAME), { force: true }),
          catch: (e) => failure("DRAFT_WRITE_FAILED", e),
        }),
    }),
  );
}
