import {
  APPROPRIATION_RATE_MAX_BP,
  APPROPRIATION_RATE_MIN_BP,
  RESEARCH_BUDGET_MAX,
  RESEARCH_BUDGET_MIN,
  monthlyRevenue,
  researchCap,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { Effect } from "effect";
import type { BudgetScreenProjection } from "../../shared/budget-contract.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { buildTreasuryCommitments } from "./treasuryCommitments.js";
import { currentRevision, submitPlayerCommand } from "./playerCommandSupport.js";

const RATE_STEP_BP = 50;

function researchCapsByRate(base: SafeInt): BudgetScreenProjection["researchCaps"] {
  const caps: { rateBp: number; cap: number }[] = [];
  for (
    let rate = APPROPRIATION_RATE_MIN_BP;
    rate <= APPROPRIATION_RATE_MAX_BP;
    rate += RATE_STEP_BP
  )
    caps.push({ rateBp: rate, cap: Number(researchCap(monthlyRevenue(base, SafeInt(rate)))) });
  return caps;
}

export const inspectBudgetScreenProgram: CommandHandler<"inspectBudgetScreen"> = (sessionId) =>
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
      researchCaps: researchCapsByRate(nation.baseResources),
      commitments: buildTreasuryCommitments(record.state.snapshot, nation),
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  });

export const submitBudgetAllocationProgram: CommandHandler<"submitBudgetAllocation"> = (payload) =>
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
  });
