import { Effect } from "effect";
import { isDebugModeEnabled } from "../debugGate.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import type { CommandHandler } from "../runtime/commandProgram.js";

export const exportGenerationReportProgram: CommandHandler<"exportGenerationReport"> = (
  sessionId,
) =>
  Effect.gen(function* () {
    if (!isDebugModeEnabled()) {
      return {
        outcome: "rejected",
        reason: "DEBUG_ONLY",
        diagnostics: ["The generation report export is only available in a debug build."],
      };
    }
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);
    if (record.legacyFleetReport === undefined) {
      return {
        outcome: "rejected",
        reason: "NO_GENERATION_REPORT",
        diagnostics: [
          "This campaign has no generation report: it started from the historical fleet, or it was loaded from a save.",
        ],
      };
    }
    return {
      outcome: "success",
      value: { report: record.legacyFleetReport },
      diagnostics: [],
    };
  });
