import type {
  AnswerDecisionPayload,
  CampaignCommandClient,
  InterruptionRequestDto,
  PlayerBattleResultDto,
  ResolveTurnResult,
  SubmitBattleResultPayload,
  SubmitOfferResponsePayload,
} from "../../shared/campaign-command-contract.js";
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
import { offerText } from "./interruptions/offer-text.js";
import { formatCampaignMonth } from "./site-header-state.js";

/**
 * The one module that answers a turn interruption. Four callbacks used to repeat
 * the same five steps — guard the request kind, mark the commit started, mint a
 * transport id, send, fold the reply — so every interruption kind added ~40 lines
 * and a branch. Here the answer is a typed value, the envelope, transport
 * identity, outcome fold, status line and failure signal live once, and the next
 * kind is a data entry rather than another callback.
 */

/** A typed answer to the outstanding interruption. */
export type InterruptionAnswer =
  | { readonly kind: "decision"; readonly optionId: string }
  | { readonly kind: "battle-delegated"; readonly choice: BattleChoice }
  | { readonly kind: "battle-outcome"; readonly outcome: PlayerBattleResultDto }
  | { readonly kind: "offer"; readonly choice: OfferChoice };

/** Why an answer was not sent. A tagged value, never prose to be sniffed. */
export type InterruptionAnswerFailure =
  | { readonly _tag: "NoCampaign" }
  | { readonly _tag: "NoOutstandingRequest" }
  | {
      readonly _tag: "AnswerDoesNotMatchRequest";
      readonly requestKind: InterruptionRequestDto["kind"];
      readonly answerKind: InterruptionAnswer["kind"];
    };

/** An assembled answer: the command to send and the fully-formed payload it carries. */
export type InterruptionCommand =
  | { readonly command: "answerDecision"; readonly payload: AnswerDecisionPayload }
  | { readonly command: "submitBattleResult"; readonly payload: SubmitBattleResultPayload }
  | { readonly command: "submitOfferResponse"; readonly payload: SubmitOfferResponsePayload };

/** The shell-visible effect of a `resolveTurn` reply, before it is dispatched. */
export type ResolveOutcome =
  | {
      readonly _tag: "Completed";
      readonly campaign: CampaignOverview | null;
      readonly message: string;
    }
  | { readonly _tag: "Suspended"; readonly interruption: ShellInterruption }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "Failed"; readonly failure: MonthCommitFailure };

/** What answering an interruption produced: a sent command's outcome, or a refusal to send. */
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

/**
 * Assemble the command for a typed answer: pick the request kind it answers,
 * stamp the campaign's session/revision, and mint the transport identity once
 * through the shared generator. Pure over its inputs, so it tests as data.
 */
export function planInterruptionAnswer(
  campaign: CampaignOverview,
  request: InterruptionRequestDto,
  answer: InterruptionAnswer,
): InterruptionCommand | InterruptionAnswerFailure {
  const envelope = { sessionId: campaign.sessionId, expectedRevision: campaign.revision };
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

/** Send a planned answer through the campaign client. */
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
    failure: { _tag: "Rejected", reason: result.reason, diagnostics: result.diagnostics },
  };
}

/**
 * Fold a `resolveTurn` reply into the shell-visible outcome: a completed turn
 * updates the header, a suspended turn opens the blocking interruption, an
 * untrustworthy pending turn opens the recovery prompt, a failure becomes a
 * typed value. Never mutates authoritative state — the command boundary already
 * validated and persisted it.
 */
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
        closingSnapshot: { month: value.closing.month, revision: value.closing.revision },
        report: { closingTreasury: value.closing.closingTreasury },
      };
      return {
        _tag: "Completed",
        campaign: previous === null ? null : overviewAfterCommit(previous, committed, sessionId),
        message: `Month advanced to ${formatCampaignMonth(value.closing.month)}.`,
      };
    }
    case "suspended":
      return {
        _tag: "Suspended",
        interruption: { request: value.request, pending: value.pendingTurn, unavailable: false },
      };
    case "unavailable":
      return { _tag: "Unavailable" };
  }
}

/**
 * The status line the player sees for a successful answer, derived from the
 * chosen option/outcome. Presentation only: it describes effects the engine
 * already applied, resolved through the UI catalogue (ADR-0209).
 */
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
      return `Battle ${answer.choice} — delegated to staff.`;
    case "battle-outcome":
      return answer.outcome.winnerId === null
        ? `Battle ${request.battleId ?? ""} ended without a decision.`
        : `Battle ${request.battleId ?? ""} resolved: ${answer.outcome.winnerId} won.`;
    case "offer": {
      const areaId = request.areaId ?? "";
      // A decline reports its victory-point cost when the month completed and the
      // turn summary carries it (the authoritative BattleDeclined event projected
      // as a message); otherwise it is reported without the figure.
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
        ? offerText(`ui.offer.result.${answer.choice}`, { areaId })
        : offerText("ui.offer.result.decline.cost", {
            areaId,
            victoryPointCost: String(cost),
          });
    }
  }
}

/**
 * Fold an answer's transport result. A rejected or errored answer surfaces the
 * tagged failure and suppresses the answer's own status line, so a failure is
 * never overwritten by a cheerful "done" message.
 */
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
