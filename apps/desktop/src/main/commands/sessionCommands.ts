import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  CopyCampaignResult,
  SaveCampaignResult,
} from "../../shared/campaign-command-contract.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandQueueStore } from "../runtime/commandQueueStore.js";
import type { CommandError } from "../runtime/commandError.js";
import { NativeDialog } from "../runtime/platform.js";
import { ProjectStore } from "../runtime/projectStore.js";

/**
 * The campaign's own lifecycle commands: save, close, and save-a-copy (INC-3;
 * ADR-0159).
 *
 * `commitMonth` already persists every committed month to the campaign's package,
 * so the live state and the active save only differ if the package was altered
 * outside the app. `saveCampaign` therefore compares the active save's
 * full-content hash with the live state's (`SaveStore.isCurrent`): it re-writes
 * only when they differ (a missing, stale or altered package) and is a no-op
 * otherwise — safe to click repeatedly without piling up identical versioned
 * copies. A spurious mismatch only costs one extra save.
 */

/** `saveCampaign` as an Effect program (INC-3): resolves the session and persists through services. */
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

    // Compare full content, not just the turn: construction and research can change the live
    // state within a turn. (`rawHash` is no use here — it does not cover nation data.)
    const revision = Number(record.state.snapshot.turnNumber);
    if (!(yield* projects.isCurrent(record.state, record.saveDir))) {
      yield* projects.save(record.state, record.saveDir);
    }
    return { outcome: "success", value: { revision }, diagnostics: [] };
  });

/** `closeCampaign` as an Effect program (INC-3): drops every session-scoped store. */
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
    // Fails with SESSION_NOT_FOUND when the session is not open.
    yield* sessions.get(sessionId);
    // Queued-but-uncommitted commands (diplomacy, divisions, research, construction) and the
    // construction workspace belong to this session only.
    yield* queue.clear(sessionId);
    yield* sessions.clearConstructionWorkspace(sessionId);
    yield* sessions.remove(sessionId);
    return { outcome: "success", value: { closed: true }, diagnostics: [] };
  });

/**
 * `copyCampaign(sessionId)` as an Effect program (INC-3b; ADR-0159): resolves
 * the session, its sidecar metadata and the copy dialog through the service
 * graph (`CampaignSessionStore`, `ProjectStore`, `NativeDialog`) and persists
 * the copy through `ProjectStore`. The target-safety check
 * (`ProjectStore.assessCopyTarget`) and every reason code are unchanged.
 */
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

    // A copy without the session sidecar (player slot, seed, scenario) could never be opened
    // again, so refuse before asking the player anything or writing anything.
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
      return { outcome: "rejected", reason: "SAVE_LOCATION_CANCELLED", diagnostics: [] };
    }
    const problem = yield* projects.assessCopyTarget(record.saveDir, location);
    if (problem !== null) {
      return { outcome: "rejected", reason: problem.reason, diagnostics: [problem.message] };
    }

    yield* projects.save(record.state, location);
    yield* projects.writeSessionMetadata(location, metadata);

    return {
      outcome: "success",
      value: { revision: Number(record.state.snapshot.turnNumber), location },
      diagnostics: [],
    };
  });
