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

export const DRAWING_BOARD_DRAFT_FILENAME = "drawing-board-draft.json";

const StoredSchema = Schema.Struct({
  schema: Schema.Literal("drawing_board_draft_v1"),
  savedAt: Schema.String,
  presetId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  log: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_DRAWING_BOARD_LOG_CHARS)),
  compatibilityVersion: Schema.optional(Schema.String),
});

const LEGACY_DRAFT_COMPATIBILITY_VERSION = "1.2.0";

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

export const readDrawingBoardDraftProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const drafts = yield* DraftStore;
    const draft = yield* drafts.load(record.saveDir);

    return { outcome: "success" as const, value: { draft }, diagnostics: [] };
  }),
);

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
