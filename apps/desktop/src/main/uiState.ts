import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Result, Schema } from "effect";
import type { UiState } from "../shared/campaign-command-contract.js";
import {
  SessionIdPayloadSchema,
  UiStateSchema,
  WriteUiStatePayloadSchema,
} from "../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import { withSchema } from "./runtime/commandProgram.js";
import { UiStateStore } from "./runtime/sidecarStores.js";

export const UI_STATE_FILENAME = "ui-state.json";

export function emptyUiState(turnNumber: number): UiState {
  return { turnNumber, dismissedFingerprints: [] };
}

function cloneTurnMessages(value: UiState["turnMessages"]): UiState["turnMessages"] {
  return value === undefined
    ? undefined
    : { pinnedIds: [...value.pinnedIds], readIds: [...value.readIds] };
}

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

export const readUiStateProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const uiStates = yield* UiStateStore;
    const uiState = yield* uiStates.load(record.saveDir, Number(record.state.snapshot.turnNumber));

    return { outcome: "success" as const, value: { uiState }, diagnostics: [] };
  }),
);

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
