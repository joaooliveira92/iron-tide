import { buildBattleHistory } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";

/**
 * `inspectBattleHistory(sessionId) -> { history }` as an Effect command program
 * (ADR-0159) — the player's resolved battles (who, where, outcome, ships lost),
 * derived read-only from the session's stored snapshot by the pure
 * `buildBattleHistory`. Same pattern as `inspectMap`: no mutation, rebuilt fresh
 * on every call; the session is resolved through `CampaignSessionStore`.
 */
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
