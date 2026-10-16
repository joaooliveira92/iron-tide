import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Result, Schema } from "effect";
import type { UiState } from "../shared/campaign-command-contract.js";
import {
  SessionIdPayloadSchema,
  UiStateSchema,
  WriteUiStatePayloadSchema,
} from "./campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import { withSchema } from "./runtime/commandProgram.js";
import { UiStateStore } from "./runtime/sidecarStores.js";

/**
 * The per-campaign renderer-owned UI-state sidecar (spec §7 "Dismissal" §8
 * "Persistence"). One mechanism serves both priority-dismissal and
 * first-month-inspection state. It is **never authoritative**: it is written
 * as a sibling of the campaign's save directory (not inside a `SaveStore`
 * save id), is not part of the envelope/hash, and is never read by
 * `MonthExecutor`. Dismissal expiry is inherent — fingerprints are only
 * honored while the sidecar's `turnNumber` equals the session's current turn.
 *
 * The filename lives next to `pointer.json`/save ids in `saveDir`, so it is
 * keyed by `campaignId` via location (one campaign save dir == one sidecar).
 */
export const UI_STATE_FILENAME = "ui-state.json";

/** Empty defaults — the tolerant-read fallback and the initial shape. */
export function emptyUiState(turnNumber: number): UiState {
  return { turnNumber, dismissedFingerprints: [] };
}

function cloneTurnMessages(value: UiState["turnMessages"]): UiState["turnMessages"] {
  return value === undefined
    ? undefined
    : { pinnedIds: [...value.pinnedIds], readIds: [...value.readIds] };
}

/**
 * The core expiry rule (spec §7 "Dismissal"): `dismissedFingerprints` are
 * honored only while `stored.turnNumber === currentTurnNumber`; on turn
 * advance the dismissal set collapses to empty. `firstMonthInspection` does
 * NOT expire — once `completed`/`dismissed` reopening stays disabled and a
 * mid-guide close resumes from the last completed step, both across turns
 * (§8 "Persistence"). Pure and deterministic; never touches authority.
 */
export function resolveUiState(stored: UiState, currentTurnNumber: number): UiState {
  const expired = stored.turnNumber !== currentTurnNumber;
  return {
    turnNumber: currentTurnNumber,
    dismissedFingerprints: expired ? [] : [...stored.dismissedFingerprints],
    firstMonthInspection: stored.firstMonthInspection,
    inspector: stored.inspector,
    turnMessages: cloneTurnMessages(stored.turnMessages),
  };
}

/**
 * Tolerant read (acceptance: missing/corrupt -> empty defaults, never
 * crashes). A missing file, unparseable JSON, or a shape that fails
 * `UiStateSchema` all fall back to `emptyUiState(currentTurnNumber)`; a
 * readable-but-stale sidecar is resolved against the current turn.
 *
 * The raw `node:*` read lives here (not in the command program): the
 * `UiStateStore` service wraps this helper, so the Effect program never
 * touches the filesystem directly.
 */
export function loadUiState(saveDir: string, currentTurnNumber: number): UiState {
  const path = join(saveDir, UI_STATE_FILENAME);
  if (!existsSync(path)) {
    return emptyUiState(currentTurnNumber);
  }
  try {
    const parsed = Schema.decodeUnknownResult(UiStateSchema)(
      JSON.parse(readFileSync(path, "utf8")),
    );
    if (Result.isFailure(parsed)) {
      return emptyUiState(currentTurnNumber);
    }
    return resolveUiState(parsed.success, currentTurnNumber);
  } catch {
    return emptyUiState(currentTurnNumber);
  }
}

/**
 * `readUiState(sessionId) -> { uiState }` as an Effect command program
 * (ADR-0159). Reads the session's sidecar through `UiStateStore` (tolerant:
 * missing/corrupt -> defaults) resolved against the session's current turn, so
 * a stale turn's dismissals are already expired on read. The session is
 * resolved through `CampaignSessionStore`, whose `SessionNotFound` failure
 * projects to the same `SESSION_NOT_FOUND` envelope as before.
 */
export const readUiStateProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const uiStates = yield* UiStateStore;
    const uiState = yield* uiStates.load(record.saveDir, Number(record.state.snapshot.turnNumber));

    return { outcome: "success" as const, value: { uiState }, diagnostics: [] };
  }),
);

/**
 * `writeUiState(payload) -> { uiState }` as an Effect command program
 * (ADR-0159). Persists the renderer's UI-state sidecar for the session's
 * campaign through `UiStateStore`. `turnNumber` is stamped from the session's
 * authoritative current turn (never trusted from the renderer), so a write
 * always reflects the live turn and expiry stays honest. The sidecar is
 * written as a sibling of the save ids in `saveDir` — outside the
 * authoritative envelope, so `SaveStore` save/load and `MonthExecutor` are
 * unaffected.
 *
 * Merge semantics (spec §7 "one mechanism for both"; INC-3 criterion 3): a
 * write only touches the fields it carries. `dismissedFingerprints` is a
 * complete-set replace (every dismissal write submits the full current set);
 * `firstMonthInspection`, when ABSENT, is carried forward from the stored
 * sidecar so a dismissal-only writer never erases inspection progress (and an
 * inspection-only writer never erases dismissals it does not carry). An
 * explicit reset of inspection remains available by sending
 * `{ status: "not_started", lastCompletedStep: 0 }`. The same rule applies to
 * the shipbuilding `inspector` layout.
 */
export const writeUiStateProgram = withSchema(WriteUiStatePayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);

    const uiStates = yield* UiStateStore;
    const currentTurnNumber = Number(record.state.snapshot.turnNumber);
    const stored = yield* uiStates.load(record.saveDir, currentTurnNumber);
    const next: UiState = {
      turnNumber: currentTurnNumber,
      dismissedFingerprints: [...payload.dismissedFingerprints],
      ...(payload.firstMonthInspection !== undefined
        ? { firstMonthInspection: { ...payload.firstMonthInspection } }
        : stored.firstMonthInspection !== undefined
          ? { firstMonthInspection: { ...stored.firstMonthInspection } }
          : {}),
      ...(payload.inspector !== undefined
        ? { inspector: { ...payload.inspector } }
        : stored.inspector !== undefined
          ? { inspector: { ...stored.inspector } }
          : {}),
      ...(payload.turnMessages !== undefined
        ? { turnMessages: cloneTurnMessages(payload.turnMessages) }
        : { turnMessages: cloneTurnMessages(stored.turnMessages) }),
    };
    yield* uiStates.save(record.saveDir, next);

    return { outcome: "success" as const, value: { uiState: next }, diagnostics: [] };
  }),
);
