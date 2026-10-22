import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  CampaignCommandClient,
  InterruptionRequestDto,
  ResolveTurnResult,
  TurnMessageDto,
} from "../../shared/campaign-command-contract.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { setUiCatalogue } from "../content/uiCatalogue.js";
import type { CampaignOverview } from "./campaign-shell-state.js";
import {
  foldInterruptionAnswer,
  foldResolveTurn,
  type InterruptionAnswer,
  type InterruptionCommand,
  planInterruptionAnswer,
  sendInterruptionAnswer,
} from "./interruption-answer.js";

const campaign: CampaignOverview = {
  month: { year: 1900, month: 1 },
  treasury: 50_000,
  revision: 3,
  sessionId: "ses-1",
  nationName: "United Kingdom",
  playerNationId: "uk",
  projectedSurplusDeficit: 2_000,
  atWar: false,
  activeAlertsCount: null,
};

const decisionRequest: InterruptionRequestDto = {
  kind: "decision",
  turnId: "t1",
  interruptionId: "i1",
  ordinal: 0,
  phase: "appropriation",
  titleKey: "messages.decision.title",
  bodyKey: "messages.decision.body",
  interpolation: {},
  decisionId: "dec-1",
  options: [
    {
      optionId: "approve",
      titleKey: "messages.decision.title",
      bodyKey: "messages.decision.body",
      hints: [],
      effects: [{ nationId: "uk", attribute: "treasury", delta: -25 }],
    },
  ],
};

const offerRequest: InterruptionRequestDto = {
  kind: "offer",
  turnId: "t1",
  interruptionId: "i-offer",
  ordinal: 0,
  phase: "battle_resolution",
  titleKey: "messages.offer.request.title",
  bodyKey: "messages.offer.request.body",
  interpolation: {},
  battleId: "battle-1",
  attackerId: "uk",
  defenderId: "france",
  areaId: "a-1",
};

const battleRequest: InterruptionRequestDto = {
  kind: "battle",
  turnId: "t1",
  interruptionId: "i-battle",
  ordinal: 0,
  phase: "battle_resolution",
  titleKey: "messages.battle.request.title",
  bodyKey: "messages.battle.request.body",
  interpolation: {},
  battleId: "battle-1",
  attackerId: "uk",
  defenderId: "france",
  areaId: "a-1",
};

const pendingTurn = {
  turnId: "t1",
  campaignId: "campaign_1",
  playerNationId: "uk",
  startingRevision: 3,
  nextInterruptionOrdinal: 0,
  recordedInputCount: 0,
  createdAt: "1900-01",
};

const summary = {
  turnId: "turn-1",
  projectionVersion: "1.0.0",
  occurredAt: "1900-01",
  rulesetVersion: "0.1.0",
  contentVersion: "0.5.0",
  messages: [] as readonly TurnMessageDto[],
};

const completed: BridgeResult<ResolveTurnResult> = {
  outcome: "success",
  value: {
    status: "completed",
    summary,
    closing: { revision: 4, month: { year: 1900, month: 2 }, closingTreasury: 22_900_000 },
  },
  diagnostics: [],
};

function planned(
  campaignOverview: CampaignOverview,
  request: InterruptionRequestDto,
  answer: InterruptionAnswer,
): InterruptionCommand {
  const plan = planInterruptionAnswer(campaignOverview, request, answer);
  if ("_tag" in plan) throw new Error(`unexpected refusal: ${plan._tag}`);
  return plan;
}

beforeEach(() => {
  setUiCatalogue({
    locale: "en-US",
    strings: {
      "ui.decision.result": "Decision made: {change}.",
      "ui.decision.result.treasury": "{nationId} treasury {delta}",
      "ui.decision.result.noEffect": "no immediate effect",
      "ui.offer.result.accept": "Battle at {areaId} accepted and resolved.",
      "ui.offer.result.delegate": "Battle at {areaId} delegated to staff and resolved.",
      "ui.offer.result.decline": "Battle at {areaId} declined.",
      "ui.offer.result.decline.cost":
        "Battle at {areaId} declined; {victoryPointCost} victory points lost.",
    },
  });
});

describe("planInterruptionAnswer", () => {
  it("assembles a decision command with the envelope and a transport identity", () => {
    const plan = planned(campaign, decisionRequest, { kind: "decision", optionId: "approve" });
    expect(plan).toMatchObject({
      command: "answerDecision",
      payload: {
        sessionId: "ses-1",
        expectedRevision: 3,
        interruptionId: "i1",
        decisionId: "dec-1",
        optionId: "approve",
      },
    });
    if (plan.command === "answerDecision") {
      expect(plan.payload.transportRequestId).toMatch(/^answerDecision-/u);
    }
  });

  it("assembles an offer command carrying the typed response", () => {
    const plan = planned(campaign, offerRequest, { kind: "offer", choice: "delegate" });
    expect(plan).toMatchObject({
      command: "submitOfferResponse",
      payload: {
        sessionId: "ses-1",
        expectedRevision: 3,
        interruptionId: "i-offer",
        battleId: "battle-1",
        response: "delegate",
      },
    });
  });

  it("assembles a delegated battle result as an explicit no-decision", () => {
    const plan = planned(campaign, battleRequest, {
      kind: "battle-delegated",
      choice: "delegate",
    });
    expect(plan).toMatchObject({
      command: "submitBattleResult",
      payload: {
        interruptionId: "i-battle",
        battleId: "battle-1",
        winnerId: null,
        loserId: null,
        attackerLosses: [],
        defenderLosses: [],
        damageReport: {},
      },
    });
  });

  it("assembles a player-fought outcome from the result DTO", () => {
    const plan = planned(campaign, battleRequest, {
      kind: "battle-outcome",
      outcome: {
        battleId: "battle-9",
        winnerId: "uk",
        loserId: "france",
        attackerLosses: ["s1"],
        defenderLosses: [],
        damageReport: { s1: 3 },
      },
    });
    expect(plan).toMatchObject({
      command: "submitBattleResult",
      payload: {
        interruptionId: "i-battle",
        battleId: "battle-9",
        winnerId: "uk",
        attackerLosses: ["s1"],
        damageReport: { s1: 3 },
      },
    });
  });

  it("refuses an answer that does not match the outstanding request, as a tagged value", () => {
    const plan = planInterruptionAnswer(campaign, decisionRequest, {
      kind: "offer",
      choice: "accept",
    });
    expect(plan).toEqual({
      _tag: "AnswerDoesNotMatchRequest",
      requestKind: "decision",
      answerKind: "offer",
    });
  });
});

describe("foldResolveTurn", () => {
  it("folds a completed turn into an updated campaign and the month line", () => {
    const outcome = foldResolveTurn(completed, campaign, "ses-1");
    expect(outcome).toEqual({
      _tag: "Completed",
      campaign: {
        month: { year: 1900, month: 2 },
        treasury: 22_900_000,
        revision: 4,
        sessionId: "ses-1",
        nationName: "United Kingdom",
        playerNationId: "uk",
        projectedSurplusDeficit: 2_000,
        atWar: false,
        activeAlertsCount: null,
      },
      message: "Month advanced to February 1900.",
    });
  });

  it("folds a suspended turn into a blocking interruption", () => {
    const outcome = foldResolveTurn(
      {
        outcome: "success",
        value: { status: "suspended", request: decisionRequest, pendingTurn },
        diagnostics: [],
      },
      campaign,
      "ses-1",
    );
    expect(outcome).toMatchObject({ _tag: "Suspended", interruption: { unavailable: false } });
  });

  it("folds an unavailable pending turn without fabricating a request", () => {
    const outcome = foldResolveTurn(
      { outcome: "success", value: { status: "unavailable" }, diagnostics: [] },
      campaign,
      "ses-1",
    );
    expect(outcome).toEqual({ _tag: "Unavailable" });
  });

  it("folds a rejection into a tagged failure", () => {
    const outcome = foldResolveTurn(
      { outcome: "rejected", reason: "SIMULATION_END_REACHED", diagnostics: ["done"] },
      campaign,
      "ses-1",
    );
    expect(outcome).toEqual({
      _tag: "Failed",
      failure: { _tag: "Rejected", reason: "SIMULATION_END_REACHED", diagnostics: ["done"] },
    });
  });

  it("folds a transport error into the same tagged failure", () => {
    const outcome = foldResolveTurn(
      { outcome: "error", reason: "BOOM", diagnostics: [] },
      campaign,
      "ses-1",
    );
    expect(outcome).toEqual({
      _tag: "Failed",
      failure: { _tag: "Rejected", reason: "BOOM", diagnostics: [] },
    });
  });
});

describe("foldInterruptionAnswer", () => {
  it("names the change a decision made when the answer landed", () => {
    const { outcome, message } = foldInterruptionAnswer(
      completed,
      decisionRequest,
      { kind: "decision", optionId: "approve" },
      campaign,
      "ses-1",
    );
    expect(outcome._tag).toBe("Completed");
    expect(message).toBe("Decision made: uk treasury -25.");
  });

  it("suppresses the answer line when the answer was rejected, so the failure shows", () => {
    const { outcome, message } = foldInterruptionAnswer(
      { outcome: "rejected", reason: "STALE", diagnostics: [] },
      decisionRequest,
      { kind: "decision", optionId: "approve" },
      campaign,
      "ses-1",
    );
    expect(outcome).toEqual({
      _tag: "Failed",
      failure: { _tag: "Rejected", reason: "STALE", diagnostics: [] },
    });
    expect(message).toBeNull();
  });

  it("reports a decline's victory-point cost from the completed turn summary", () => {
    const declined: BridgeResult<ResolveTurnResult> = {
      outcome: "success",
      value: {
        status: "completed",
        summary: {
          ...summary,
          messages: [
            {
              id: "m1",
              turnId: "turn-1",
              occurredAt: "1900-01",
              phase: "battle_resolution",
              category: "battle",
              severity: "NORMAL",
              titleKey: "messages.battle.declined.title",
              bodyKey: "messages.battle.declined.body",
              interpolation: { battleId: "battle-1", areaId: "a-1", victoryPointCost: 5 },
              subjectRefs: [],
              effectRefs: [],
              blocking: false,
              requiresAcknowledgement: false,
              playerVisible: true,
            },
          ],
        },
        closing: { revision: 4, month: { year: 1900, month: 2 }, closingTreasury: 22_900_000 },
      },
      diagnostics: [],
    };
    const { message } = foldInterruptionAnswer(
      declined,
      offerRequest,
      { kind: "offer", choice: "decline" },
      campaign,
      "ses-1",
    );
    expect(message).toBe("Battle at a-1 declined; 5 victory points lost.");
  });

  it("reports a decline without the figure when the turn stays suspended", () => {
    const { message } = foldInterruptionAnswer(
      {
        outcome: "success",
        value: { status: "suspended", request: offerRequest, pendingTurn },
        diagnostics: [],
      },
      offerRequest,
      { kind: "offer", choice: "decline" },
      campaign,
      "ses-1",
    );
    expect(message).toBe("Battle at a-1 declined.");
  });
});

describe("sendInterruptionAnswer", () => {
  it("routes each planned command to its client command", () => {
    const execute = vi.fn();
    const client: CampaignCommandClient = { execute };

    void sendInterruptionAnswer(
      client,
      planned(campaign, offerRequest, { kind: "offer", choice: "accept" }),
    );
    void sendInterruptionAnswer(
      client,
      planned(campaign, decisionRequest, { kind: "decision", optionId: "approve" }),
    );

    expect(execute).toHaveBeenCalledWith("submitOfferResponse", expect.any(Object));
    expect(execute).toHaveBeenCalledWith("answerDecision", expect.any(Object));
  });
});
