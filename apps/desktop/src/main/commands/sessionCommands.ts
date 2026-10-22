import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { CopyCampaignResult, SaveCampaignResult } from "../../shared/campaign-contract.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandQueueStore } from "../runtime/commandQueueStore.js";
import type { CommandError } from "../runtime/commandError.js";
import { NativeDialog } from "../runtime/platform.js";
import { ProjectStore } from "../runtime/projectStore.js";

export const saveCampaignProgram = (
  sessionId: string,
): Effect.Effect<
  BridgeResult<SaveCampaignResult>,
  CommandError,
  CampaignSessionStore | ProjectStore
> =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const projects = yield* ProjectStore;
    const record = yield* sessions.get(sessionId);

    const revision = Number(record.state.snapshot.turnNumber);
    if (!(yield* projects.isCurrent(record.state, record.saveDir))) {
      yield* projects.save(record.state, record.saveDir);
    }
    return { outcome: "success", value: { revision }, diagnostics: [] };
  });

export const closeCampaignProgram = (
  sessionId: string,
): Effect.Effect<
  BridgeResult<{ closed: true }>,
  CommandError,
  CampaignSessionStore | CommandQueueStore
> =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueueStore;
    yield* sessions.get(sessionId);
    yield* queue.clear(sessionId);
    yield* sessions.clearConstructionWorkspace(sessionId);
    yield* sessions.remove(sessionId);
    return { outcome: "success", value: { closed: true }, diagnostics: [] };
  });

export const copyCampaignProgram = (
  sessionId: string,
): Effect.Effect<
  BridgeResult<CopyCampaignResult>,
  CommandError,
  CampaignSessionStore | ProjectStore | NativeDialog
> =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const projects = yield* ProjectStore;
    const dialogs = yield* NativeDialog;
    const record = yield* sessions.get(sessionId);

    const metadata = yield* projects.readSessionMetadata(record.saveDir);
    if (metadata === null) {
      return {
        outcome: "error",
        reason: "SESSION_METADATA_MISSING",
        diagnostics: [
          "This campaign's session file is missing, so a copy could not be opened later.",
        ],
      };
    }

    const location = yield* dialogs.chooseCopyDirectory(`bluewave-${record.playerSlotId}-copy`);
    if (location === null) {
      return {
        outcome: "rejected",
        reason: "SAVE_LOCATION_CANCELLED",
        diagnostics: [],
      };
    }
    const problem = yield* projects.assessCopyTarget(record.saveDir, location);
    if (problem !== null) {
      return {
        outcome: "rejected",
        reason: problem.reason,
        diagnostics: [problem.message],
      };
    }

    yield* projects.save(record.state, location);
    yield* projects.writeSessionMetadata(location, metadata);

    return {
      outcome: "success",
      value: { revision: Number(record.state.snapshot.turnNumber), location },
      diagnostics: [],
    };
  });
