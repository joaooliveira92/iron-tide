import { buildPrioritiesProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import type { CommandHandler } from "../runtime/commandProgram.js";

export const inspectPrioritiesProgram: CommandHandler<"inspectPriorities"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const priorities = buildPrioritiesProjection(record.state.snapshot, record.playerSlotId);
    return { outcome: "success" as const, value: { priorities }, diagnostics: [] };
  });
