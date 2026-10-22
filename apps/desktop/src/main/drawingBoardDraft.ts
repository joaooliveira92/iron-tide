import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { decodeLog, PersistenceError } from "@bluewave/ship-design";
import { Effect, Result, Schema } from "effect";
import type { DrawingBoardDraftRecord } from "../shared/design-contract.js";
import {
  MAX_DRAWING_BOARD_LOG_CHARS,
  SessionIdPayloadSchema,
  WriteDrawingBoardDraftPayloadSchema,
} from "../shared/campaignCommandSchemas.js";

export { WriteDrawingBoardDraftPayloadSchema };
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import { CommandRejected } from "./runtime/commandError.js";
import { withSchema } from "./runtime/commandProgram.js";
import { Clock } from "./runtime/platform.js";
import { DraftStore } from "./runtime/sidecarStores.js";

/**
 * The Drawing Board's working design for a campaign: the starting design and the undoable edit log, so closing the
 * board, leaving the screen or restarting the app never loses work. Renderer-owned and never authoritative, like
 * `ui-state.json`: a sibling of the save ids in the campaign's save directory, outside the envelope and hash, never read by
 * the engine. Written atomically (tmp file, then rename).
 */
export const DRAWING_BOARD_DRAFT_FILENAME = "drawing-board-draft.json";

const StoredSchema = Schema.Struct({
  schema: Schema.Literal("drawing_board_draft_v1"),
  savedAt: Schema.String,
  presetId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  log: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_DRAWING_BOARD_LOG_CHARS)),
  /** Absent in drafts written before the 2.0.0 gate; those were written under 1.2.0. */
  compatibilityVersion: Schema.optional(Schema.String),
});

/** Version a draft without a stamp was written under (ship-part-model ticket 10). */
const LEGACY_DRAFT_COMPATIBILITY_VERSION = "1.2.0";

/**
 * Tolerant read: a missing, unreadable or malformed file is "no draft", never a crash.
 *
 * The raw `node:*` read lives here (not in the command program): the
 * `DraftStore` service wraps this helper, so the Effect program never touches
 * the filesystem directly. The version-mismatch rename also stays inside the
 * store.
 */
export function loadDrawingBoardDraft(
  saveDir: string,
  currentVersion: string = CURRENT_COMPATIBILITY_VERSION,
): DrawingBoardDraftRecord | null {
  const path = join(saveDir, DRAWING_BOARD_DRAFT_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const parsed = Schema.decodeUnknownResult(StoredSchema)(JSON.parse(readFileSync(path, "utf8")));
    if (Result.isFailure(parsed)) return null;
    const draftVersion = parsed.success.compatibilityVersion ?? LEGACY_DRAFT_COMPATIBILITY_VERSION;
    if (draftVersion !== currentVersion) {
      // Not restored: the workspace starts from the default design. The old draft is
      // preserved under its version suffix before any new save could overwrite it.
      renameSync(path, `${path}.${draftVersion}`);
      return null;
    }
    decodeLog(parsed.success.log);
    return {
      presetId: parsed.success.presetId,
      log: parsed.success.log,
      savedAt: parsed.success.savedAt,
    };
  } catch {
    return null;
  }
}

/**
 * `readDrawingBoardDraft(sessionId) -> { draft }` as an Effect command program
 * (ADR-0159). Reads the session's working design through `DraftStore`
 * (tolerant: a missing/corrupt/foreign-version file is "no draft"). The
 * session is resolved through `CampaignSessionStore`, whose `SessionNotFound`
 * failure projects to the same `SESSION_NOT_FOUND` envelope as before.
 */
export const readDrawingBoardDraftProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const drafts = yield* DraftStore;
    const draft = yield* drafts.load(record.saveDir);

    return { outcome: "success" as const, value: { draft }, diagnostics: [] };
  }),
);

/**
 * `writeDrawingBoardDraft(payload) -> { saved }` as an Effect command program
 * (ADR-0159). Saves the working design through `DraftStore`, or removes it
 * (`draft: null`) when there is nothing left to keep. The `savedAt` stamp comes
 * from the `Clock` service (not wall-clock read inside the program) and the
 * `compatibilityVersion` stamp from `DraftStore`. A log that is not a decodable
 * edit log is a recoverable `CommandRejected` (`INVALID_COMMAND_PAYLOAD`),
 * matching the former envelope byte-for-byte; a failed write is
 * `DRAFT_WRITE_FAILED`.
 */
export const writeDrawingBoardDraftProgram = withSchema(
  WriteDrawingBoardDraftPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const record = yield* sessions.get(payload.sessionId);
      const drafts = yield* DraftStore;

      const draft = payload.draft;
      if (draft === null) {
        yield* drafts.remove(record.saveDir);
        return { outcome: "success" as const, value: { saved: false }, diagnostics: [] };
      }

      yield* Effect.try({
        try: () => decodeLog(draft.log),
        catch: (error) =>
          new CommandRejected({
            reason: "INVALID_COMMAND_PAYLOAD",
            diagnostics: [PersistenceError.is(error) ? error.message : "not an edit log"],
          }),
      });

      const clock = yield* Clock;
      const savedAt = (yield* clock.now()).toISOString();
      yield* drafts.save(record.saveDir, draft, savedAt);

      return { outcome: "success" as const, value: { saved: true }, diagnostics: [] };
    }),
);
