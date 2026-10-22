import { buildBattleHistory } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";

export const inspectBattleHistoryProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
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
  }),
);
