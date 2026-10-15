import { buildOpeningBriefingProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";

/**
 * `inspectOpeningBriefing(sessionId) -> InspectOpeningBriefingResult`
 * (game-onboarding INC-8, spec §8) as an Effect command program (ADR-0159):
 * the Opening Strategic Briefing's slice of the compiled snapshot, shown once
 * after world generation and before the Overview dashboard. Purely read-only —
 * derives everything from the session's compiled `CampaignState` via
 * `buildOpeningBriefingProjection` (same convention as
 * `inspectDiplomacyScreen`), never mutating state.
 *
 * Session lookup fails with `SessionNotFound` (projected to `SESSION_NOT_FOUND`)
 * and player-slot resolution fails with `UNKNOWN_PLAYER_SLOT`, following the
 * established inspect-command pattern.
 */
export const inspectOpeningBriefingProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
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
  }),
);
