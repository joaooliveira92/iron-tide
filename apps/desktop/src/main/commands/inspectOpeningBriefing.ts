import { buildOpeningBriefingProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";

export const inspectOpeningBriefingProgram: CommandHandler<"inspectOpeningBriefing"> = (
  sessionId,
) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const projection = buildOpeningBriefingProjection(
      record.state,
      record.playerSlotId,
      record.month,
    );
    if (!projection) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }

    return { outcome: "success" as const, value: { projection }, diagnostics: [] };
  });
