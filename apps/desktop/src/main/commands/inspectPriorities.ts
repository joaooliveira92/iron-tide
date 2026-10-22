import { buildPrioritiesProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";

export const inspectPrioritiesProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const priorities = buildPrioritiesProjection(record.state.snapshot, record.playerSlotId);
    return { outcome: "success" as const, value: { priorities }, diagnostics: [] };
  }),
);
