import { buildPlayerProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";

/**
 * `inspectCampaign(sessionId) -> { projection }` (ticket 08/12) as an Effect
 * command program (ADR-0159). Rebuilds the `PlayerProjection` fresh from the
 * session's stored `CampaignState` every call, rather than caching one at
 * compile time — so later tickets (`commitMonth` et al.) only need to update
 * the session's stored state and this stays correct without any extra wiring.
 * The session is resolved through `CampaignSessionStore`, whose `SessionNotFound`
 * failure projects to the same `SESSION_NOT_FOUND` envelope as before.
 */
export const inspectCampaignProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const projection = buildPlayerProjection(record.state, record.playerSlotId, record.month);
    if (!projection) {
      return yield* new CommandFailed({
        reason: "PROJECTION_FAILED",
        diagnostics: [`Could not build a projection for nation ${record.playerSlotId}`],
      });
    }

    return { outcome: "success" as const, value: { projection }, diagnostics: [] };
  }),
);
