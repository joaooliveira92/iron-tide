import { buildBattleHistory } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import type { CommandHandler } from "../runtime/commandProgram.js";

export const inspectBattleHistoryProgram: CommandHandler<"inspectBattleHistory"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const snapshot = record.state.snapshot;
    return {
      outcome: "success" as const,
      value: {
        revision: Number(snapshot.turnNumber),
        history: buildBattleHistory(snapshot, record.playerSlotId),
      },
      diagnostics: [],
    };
  });
