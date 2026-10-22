import { buildPrioritiesProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";

/**
 * `inspectPriorities(sessionId) -> { priorities }` as an Effect command program
 * (game-onboarding INC-10, spec §14; ADR-0159). Rebuilds the read-only
 * priorities projection fresh from the session's stored `CampaignState` — pure,
 * deterministic, never mutates authoritative state. Warnings section of the
 * pre-turn review IS this projection (spec §14); the engine remains the
 * authority, the renderer never recomputes priorities itself. The session is
 * resolved through `CampaignSessionStore`.
 */
export const inspectPrioritiesProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const priorities = buildPrioritiesProjection(record.state.snapshot, record.playerSlotId);
    return { outcome: "success" as const, value: { priorities }, diagnostics: [] };
  }),
);
