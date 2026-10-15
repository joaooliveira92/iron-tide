import {
  APPROPRIATION_RATE_MAX_BP,
  APPROPRIATION_RATE_MIN_BP,
  RESEARCH_BUDGET_MAX,
  RESEARCH_BUDGET_MIN,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { Effect } from "effect";
import type { BudgetScreenProjection } from "../../shared/budget-contract.js";
import {
  SessionIdPayloadSchema,
  SubmitBudgetAllocationPayloadSchema,
} from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { currentRevision, submitPlayerCommand } from "./playerCommandSupport.js";

/**
 * Budget allocation (ADR-0060), as native `CommandProgram`s (INC-5; ADR-0159).
 * Same authority model as diplomacy: the desktop queues a real
 * `SetBudgetAllocation` envelope; the engine validates the bounds at issue time
 * and is the sole mutator when `commitMonth` applies it. Every session/queue
 * read goes through the desktop service graph (`CampaignSessionStore`,
 * `CommandQueueStore`), never the module singletons.
 */
export const inspectBudgetScreenProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const nation = record.state.snapshot.nations.get(record.playerSlotId);
    if (!nation) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }

    const value: BudgetScreenProjection = {
      revision: currentRevision(record),
      month: record.month,
      appropriationRateBp: Number(nation.navalAppropriationRateBp),
      researchBudget: Number(
        nation.research.standingResearchBudget ?? nation.research.researchBudget,
      ),
      bounds: {
        appropriationRateMinBp: APPROPRIATION_RATE_MIN_BP,
        appropriationRateMaxBp: APPROPRIATION_RATE_MAX_BP,
        researchBudgetMin: RESEARCH_BUDGET_MIN,
        researchBudgetMax: RESEARCH_BUDGET_MAX,
      },
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);

export const submitBudgetAllocationProgram = withSchema(
  SubmitBudgetAllocationPayloadSchema,
  (payload) =>
    submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "SetBudgetAllocation",
          nationId: record.playerSlotId,
          appropriationRateBp: SafeInt(payload.appropriationRateBp),
          researchBudget: SafeInt(payload.researchBudget),
        },
        discriminator: "budget",
      }),
    }),
);
