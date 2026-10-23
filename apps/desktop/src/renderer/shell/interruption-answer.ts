import type {
  AnswerDecisionPayload,
  CampaignCommandClient,
  SubmitBattleResultPayload,
  SubmitOfferResponsePayload,
} from "../../shared/campaign-contract.js";
import type {
  InterruptionRequestDto,
  ResolveTurnResult,
} from "../../shared/turn-message-contract.js";
import type { PlayerBattleResultDto } from "../../shared/player-battle-contract.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { resolveMessage } from "../content/uiCatalogue.js";
import { createTransportRequestId } from "../lib/command-screen-workflow.js";
import { type CommittedMonth, overviewAfterCommit } from "./campaign-overview.js";
import type {
  CampaignOverview,
  MonthCommitFailure,
  ShellInterruption,
} from "./campaign-shell-state.js";
import type { BattleChoice } from "./interruptions/BattleRequestDialog.js";
import type { OfferChoice } from "./interruptions/OfferDialog.js";
import { formatCampaignMonth } from "./site-header-state.js";

export type InterruptionAnswer =
  | { readonly kind: "decision"; readonly optionId: string }
  | { readonly kind: "battle-delegated"; readonly choice: BattleChoice }
  | { readonly kind: "battle-outcome"; readonly outcome: PlayerBattleResultDto }
  | { readonly kind: "offer"; readonly choice: OfferChoice };

export type InterruptionAnswerFailure =
  | { readonly _tag: "NoCampaign" }
  | { readonly _tag: "NoOutstandingRequest" }
  | {
      readonly _tag: "AnswerDoesNotMatchRequest";
      readonly requestKind: InterruptionRequestDto["kind"];
      readonly answerKind: InterruptionAnswer["kind"];
    };

export type InterruptionCommand =
  | {
      readonly command: "answerDecision";
      readonly payload: AnswerDecisionPayload;
    }
  | {
      readonly command: "submitBattleResult";
      readonly payload: SubmitBattleResultPayload;
    }
  | {
      readonly command: "submitOfferResponse";
      readonly payload: SubmitOfferResponsePayload;
    };

export type ResolveOutcome =
  | {
      readonly _tag: "Completed";
      readonly campaign: CampaignOverview | null;
      readonly message: string;
    }
  | { readonly _tag: "Suspended"; readonly interruption: ShellInterruption }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "Failed"; readonly failure: MonthCommitFailure };

export type InterruptionAnswerOutcome =
  | { readonly _tag: "Sent"; readonly outcome: ResolveOutcome }
  | { readonly _tag: "NotSent"; readonly reason: InterruptionAnswerFailure };

function mismatch(
  request: InterruptionRequestDto,
  answer: InterruptionAnswer,
): InterruptionAnswerFailure {
  return {
    _tag: "AnswerDoesNotMatchRequest",
    requestKind: request.kind,
    answerKind: answer.kind,
  };
}

export function planInterruptionAnswer(
  campaign: CampaignOverview,
  request: InterruptionRequestDto,
  answer: InterruptionAnswer,
): InterruptionCommand | InterruptionAnswerFailure {
  const envelope = {
    sessionId: campaign.sessionId,
    expectedRevision: campaign.revision,
  };
  if (answer.kind === "decision") {
    if (request.kind !== "decision") return mismatch(request, answer);
    return {
      command: "answerDecision",
      payload: {
        ...envelope,
        transportRequestId: createTransportRequestId("answerDecision"),
        interruptionId: request.interruptionId,
        decisionId: request.decisionId ?? "",
        optionId: answer.optionId,
      },
    };
  }
  if (answer.kind === "offer") {
    if (request.kind !== "offer") return mismatch(request, answer);
    return {
      command: "submitOfferResponse",
      payload: {
        ...envelope,
        transportRequestId: createTransportRequestId("submitOfferResponse"),
        interruptionId: request.interruptionId,
        battleId: request.battleId ?? "",
        response: answer.choice,
      },
    };
  }
  if (request.kind !== "battle") return mismatch(request, answer);
  const outcome = answer.kind === "battle-outcome" ? answer.outcome : null;
  return {
    command: "submitBattleResult",
    payload: {
      ...envelope,
      transportRequestId: createTransportRequestId("submitBattleResult"),
      interruptionId: request.interruptionId,
      battleId: outcome?.battleId ?? request.battleId ?? "",
      winnerId: outcome?.winnerId ?? null,
      loserId: outcome?.loserId ?? null,
      attackerLosses: outcome?.attackerLosses ?? [],
      defenderLosses: outcome?.defenderLosses ?? [],
      damageReport: outcome?.damageReport ?? {},
    },
  };
}

export function sendInterruptionAnswer(
  client: CampaignCommandClient,
  command: InterruptionCommand,
): Promise<BridgeResult<ResolveTurnResult>> {
  switch (command.command) {
    case "answerDecision":
      return client.execute("answerDecision", command.payload);
    case "submitBattleResult":
      return client.execute("submitBattleResult", command.payload);
    case "submitOfferResponse":
      return client.execute("submitOfferResponse", command.payload);
  }
}

function failed(
  result: Exclude<BridgeResult<ResolveTurnResult>, { outcome: "success" }>,
): Extract<ResolveOutcome, { _tag: "Failed" }> {
  return {
    _tag: "Failed",
    failure: {
      _tag: "Rejected",
      reason: result.reason,
      diagnostics: result.diagnostics,
    },
  };
}

export function foldResolveTurn(
  result: BridgeResult<ResolveTurnResult>,
  previous: CampaignOverview | null,
  sessionId: string,
): ResolveOutcome {
  if (result.outcome !== "success") return failed(result);
  const value = result.value;
  switch (value.status) {
    case "completed": {
      const committed: CommittedMonth = {
        closingSnapshot: {
          month: value.closing.month,
          revision: value.closing.revision,
        },
        report: { closingTreasury: value.closing.closingTreasury },
      };
      return {
        _tag: "Completed",
        campaign: previous === null ? null : overviewAfterCommit(previous, committed, sessionId),
        message: resolveMessage("shell.month.advanced", {
          month: formatCampaignMonth(value.closing.month),
        }),
      };
    }
    case "suspended":
      return {
        _tag: "Suspended",
        interruption: {
          request: value.request,
          pending: value.pendingTurn,
          unavailable: false,
        },
      };
    case "unavailable":
      return { _tag: "Unavailable" };
  }
}

function describeAnswer(
  request: InterruptionRequestDto,
  answer: InterruptionAnswer,
  value: ResolveTurnResult,
): string {
  switch (answer.kind) {
    case "decision": {
      const option = request.options?.find((candidate) => candidate.optionId === answer.optionId);
      const effects = option?.effects ?? [];
      const change =
        effects.length === 0
          ? resolveMessage("ui.decision.result.noEffect")
          : effects
              .map((effect) =>
                resolveMessage("ui.decision.result.treasury", {
                  nationId: effect.nationId,
                  delta: `${effect.delta >= 0 ? "+" : ""}${String(effect.delta)}`,
                }),
              )
              .join("; ");
      return resolveMessage("ui.decision.result", { change });
    }
    case "battle-delegated":
      return resolveMessage("ui.battle.result.delegated", { battleChoice: answer.choice });
    case "battle-outcome":
      return answer.outcome.winnerId === null
        ? resolveMessage("ui.battle.result.undecided", { battleId: request.battleId ?? "" })
        : resolveMessage("ui.battle.result.won", {
            battleId: request.battleId ?? "",
            winnerId: answer.outcome.winnerId,
          });
    case "offer": {
      const areaId = request.areaId ?? "";
      const declined =
        answer.choice === "decline" && value.status === "completed"
          ? value.summary.messages.find(
              (message) =>
                message.bodyKey === "messages.battle.declined.body" &&
                message.interpolation["battleId"] === request.battleId,
            )
          : undefined;
      const cost = declined?.interpolation["victoryPointCost"];
      return cost === undefined
        ? resolveMessage(`ui.offer.result.${answer.choice}`, { areaId })
        : resolveMessage("ui.offer.result.decline.cost", {
            areaId,
            victoryPointCost: String(cost),
          });
    }
  }
}

export function foldInterruptionAnswer(
  result: BridgeResult<ResolveTurnResult>,
  request: InterruptionRequestDto,
  answer: InterruptionAnswer,
  previous: CampaignOverview | null,
  sessionId: string,
): { readonly outcome: ResolveOutcome; readonly message: string | null } {
  if (result.outcome !== "success") {
    return { outcome: failed(result), message: null };
  }
  return {
    outcome: foldResolveTurn(result, previous, sessionId),
    message: describeAnswer(request, answer, result.value),
  };
}
