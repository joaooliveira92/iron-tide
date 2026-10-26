import { buildStrategicMapView } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";

export const inspectMapProgram: CommandHandler<"inspectMap"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    if (!record.state.snapshot.nations.has(record.playerSlotId)) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }

    return {
      outcome: "success" as const,
      value: {
        revision: Number(record.state.snapshot.turnNumber),
        month: record.month,
        playerNationId: record.playerSlotId,
        strategic: buildStrategicMapView(record.state.snapshot, record.playerSlotId),
      },
      diagnostics: [],
    };
  });
