import { buildStrategicMapView } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";
import { CommandFailed } from "../runtime/commandError.js";

/**
 * `inspectMap(sessionId) -> { revision, month, playerNationId, strategic }` as
 * an Effect command program (ADR-0159) — the viewer-scoped strategic map
 * projection for F-1 (decision request 0037 Option B): the player's fleets in
 * full, public facts for the rest, foreign fleets withheld, with per-fleet
 * legal destinations and the player's blockades. Read-only, rebuilt fresh from
 * the session's stored `CampaignState` every call via `@bluewave/campaign`-engine's
 * pure `buildStrategicMapView`, so the map draws only what the player could
 * know. The session is resolved through `CampaignSessionStore`.
 */
export const inspectMapProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
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
  }),
);
