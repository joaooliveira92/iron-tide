import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  InterruptionRequestDto,
  PlayerBattleResultDto,
  ResolveTurnResult,
} from "../../shared/campaign-command-contract.js";
import { resolveMessage } from "../content/uiCatalogue.js";
import { emitWideEvent } from "../lib/telemetry.js";
import type { Screen } from "./campaign-screen-registry.js";
import {
  loadActiveAlertsCount,
  overviewAfterCommit,
  overviewFromProjection,
  type CommittedMonth,
} from "./campaign-overview.js";
import {
  campaignShellMode,
  currentShellScreen,
  initialCampaignShellState,
  reduceCampaignShell,
  type ShellInterruption,
} from "./campaign-shell-state.js";
import { canGoBack, canGoForward, goBack, goForward } from "./navigation-history.js";
import type { BattleChoice } from "./interruptions/BattleRequestDialog.js";
import type { OfferChoice } from "./interruptions/OfferDialog.js";
import { offerText } from "./interruptions/offer-text.js";
import type { PrimaryAction } from "./primary-action.js";
import { formatCampaignMonth } from "./site-header-state.js";

const SAVE_MESSAGE_DURATION_MS = 8_000;

function diagnosticsSuffix(diagnostics: readonly string[]): string {
  return diagnostics.length > 0 ? ` ${diagnostics.join("; ")}` : "";
}

/**
 * A presentation-only result line for an answered decision, derived from the
 * chosen option's declared effects. It never owns authoritative state — it only
 * describes what the engine already applied — and resolves through the UI
 * catalogue, so the domain packages embed no prose (ADR-0209).
 */
function decisionResultMessage(request: InterruptionRequestDto, optionId: string): string {
  const option = request.options?.find((candidate) => candidate.optionId === optionId);
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

export function useCampaignShell(bridge: BluewaveDesktopBridge | undefined) {
  const [state, dispatch] = useReducer(reduceCampaignShell, undefined, initialCampaignShellState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped whenever the campaign is closed or a newer refresh starts, so a response that
  // arrives late (out of order, or after Close) is dropped instead of overwriting newer state.
  const refreshGenerationRef = useRef(0);

  /** Show a transient status message in the header; null just ends the "saving" state silently. */
  const collectMessage = useCallback((message: string | null): void => {
    dispatch({ type: "save-finished", message });
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(
      () => dispatch({ type: "save-message-cleared" }),
      SAVE_MESSAGE_DURATION_MS,
    );
  }, []);

  const openCampaign = useCallback(
    async (sessionId: string) => {
      if (bridge === undefined) return;
      dispatch({ type: "campaign-opening" });
      const started = performance.now();
      try {
        const result = await bridge.campaign.execute("inspectCampaign", sessionId);
        const duration = Math.round(performance.now() - started);
        if (result.outcome !== "success") {
          emitWideEvent("campaign_open", sessionId, duration, "rejected", [result.reason]);
          dispatch({
            type: "campaign-open-failed",
            message: `Inspection failed: ${result.reason}`,
          });
          return;
        }
        emitWideEvent("campaign_open", sessionId, duration, "success");
        const alerts = await loadActiveAlertsCount(bridge, sessionId);
        dispatch({
          type: "campaign-opened",
          campaign: overviewFromProjection(sessionId, result.value.projection, alerts),
        });
        // A campaign holding a suspended turn prompts the player to resume it.
        // Fire-and-forget: the pending read never delays or fails opening.
        void bridge.campaign
          .execute("readPendingTurn", sessionId)
          .then((pending) => {
            if (pending.outcome === "success" && pending.value.pending !== null) {
              dispatch({
                type: "interruption-set",
                interruption: {
                  request: null,
                  pending: pending.value.pending,
                  // A stored but incompatible record is reported unavailable on
                  // load, so the prompt never offers a resume that would fail.
                  unavailable: !pending.value.valid,
                },
              });
            }
          })
          .catch(() => undefined);
      } catch (error) {
        dispatch({
          type: "campaign-open-failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [bridge],
  );

  const closeCampaign = useCallback(async () => {
    if (bridge === undefined || state.campaign === null) return;
    const started = performance.now();
    const result = await bridge.campaign.execute("closeCampaign", state.campaign.sessionId);
    const duration = Math.round(performance.now() - started);
    if (result.outcome === "success" || result.reason === "SESSION_NOT_FOUND") {
      emitWideEvent("campaign_close", state.campaign.sessionId, duration, "success");
      refreshGenerationRef.current += 1;
      dispatch({ type: "campaign-closed" });
      return;
    }
    emitWideEvent("campaign_close", state.campaign.sessionId, duration, "rejected", [
      result.reason,
    ]);
    collectMessage(`Could not close the campaign: ${result.reason}.`);
  }, [bridge, state.campaign]);

  const saveCampaign = useCallback(async () => {
    if (bridge === undefined || state.campaign === null) return;
    dispatch({ type: "save-started" });
    const result = await bridge.campaign.execute("saveCampaign", state.campaign.sessionId);
    collectMessage(
      result.outcome === "success"
        ? `Campaign saved — revision ${result.value.revision}.`
        : result.reason === "CANCELLED"
          ? null
          : `Save failed: ${result.reason}.${diagnosticsSuffix(result.diagnostics)}`,
    );
  }, [bridge, state.campaign]);

  /** "Save a copy…": the player picks a location; cancelling is silent, never an error. */
  const copyCampaign = useCallback(async () => {
    if (bridge === undefined || state.campaign === null) return;
    dispatch({ type: "save-started" });
    const result = await bridge.campaign.execute("copyCampaign", state.campaign.sessionId);
    collectMessage(
      result.outcome === "success"
        ? `Copy saved to ${result.value.location}.`
        : result.reason === "SAVE_LOCATION_CANCELLED"
          ? null
          : `Copy failed: ${result.reason}.${diagnosticsSuffix(result.diagnostics)}`,
    );
  }, [bridge, state.campaign]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const selectScreen = useCallback((screen: Screen) => dispatch({ type: "visit", screen }), []);

  /**
   * Re-reads the header's campaign summary (month, treasury, revision,
   * projected balance, war status) from the engine. Called after every month
   * advance — from the header or from the Simulation screen — so the header
   * never shows a stale month or "Armed peace" during a war.
   */
  const refreshCampaign = useCallback(
    async (sessionIdOverride?: string) => {
      const sessionId = sessionIdOverride ?? state.campaign?.sessionId;
      if (bridge === undefined || sessionId === undefined) return;
      const generation = ++refreshGenerationRef.current;
      const result = await bridge.campaign.execute("inspectCampaign", sessionId);
      if (result.outcome !== "success") return;
      const alerts = await loadActiveAlertsCount(bridge, sessionId);
      // A newer refresh started, or the campaign was closed, while we waited: drop this one.
      if (generation !== refreshGenerationRef.current) return;
      dispatch({
        type: "campaign-refreshed",
        campaign: overviewFromProjection(sessionId, result.value.projection, alerts),
      });
    },
    [bridge, state.campaign?.sessionId],
  );

  const setInterruption = useCallback((interruption: ShellInterruption | null) => {
    dispatch(
      interruption === null
        ? { type: "interruption-cleared" }
        : { type: "interruption-set", interruption },
    );
  }, []);

  /**
   * Project a `resolveTurn` response into the shell: a completed turn updates the
   * header; a suspended turn opens the blocking interruption; an untrustworthy
   * pending turn opens the recovery prompt. Never mutates authoritative state
   * here — the command boundary already validated and persisted it.
   */
  const applyResolveResult = useCallback(
    (result: BridgeResult<ResolveTurnResult>, sessionId: string) => {
      if (result.outcome !== "success") {
        dispatch({
          type: "month-commit-failed",
          message: `Could not advance month: ${result.reason}.${diagnosticsSuffix(result.diagnostics)}`,
        });
        return;
      }
      const value = result.value;
      if (value.status === "completed") {
        const previous = state.campaign;
        if (previous !== null) {
          const committed: CommittedMonth = {
            closingSnapshot: { month: value.closing.month, revision: value.closing.revision },
            report: { closingTreasury: value.closing.closingTreasury },
          };
          dispatch({
            type: "month-committed",
            campaign: overviewAfterCommit(previous, committed, sessionId),
          });
        }
        setInterruption(null);
        void refreshCampaign(sessionId);
        collectMessage(`Month advanced to ${formatCampaignMonth(value.closing.month)}.`);
        return;
      }
      if (value.status === "suspended") {
        setInterruption({ request: value.request, pending: value.pendingTurn, unavailable: false });
        return;
      }
      setInterruption({ request: null, pending: null, unavailable: true });
    },
    [state.campaign, collectMessage, refreshCampaign, setInterruption],
  );

  const advanceMonth = useCallback(async () => {
    if (bridge === undefined || state.campaign === null) return;
    // A blocking decision or battle must be answered (or the turn abandoned)
    // before the month can advance; a pending-turn recovery prompt (no request)
    // legitimately resumes via this same path.
    if (state.interruption?.request != null) return;
    dispatch({ type: "month-commit-started" });
    const sessionId = state.campaign.sessionId;
    const started = performance.now();
    try {
      const result = await bridge.campaign.execute("resolveTurn", {
        sessionId,
        expectedRevision: state.campaign.revision,
        transportRequestId: crypto.randomUUID(),
      });
      const duration = Math.round(performance.now() - started);
      emitWideEvent(
        "campaign_month_advance",
        sessionId,
        duration,
        result.outcome === "success" ? "success" : "rejected",
        result.outcome === "success" ? [] : [result.reason],
      );
      applyResolveResult(result, sessionId);
    } catch (error) {
      emitWideEvent("campaign_month_advance", sessionId, 0, "rejected", [
        error instanceof Error ? error.message : "Unknown error",
      ]);
      dispatch({
        type: "month-commit-failed",
        message: error instanceof Error ? error.message : "Could not advance month.",
      });
    }
  }, [bridge, state.campaign, state.interruption, applyResolveResult]);

  const answerDecision = useCallback(
    async (optionId: string) => {
      const request = state.interruption?.request;
      if (
        bridge === undefined ||
        state.campaign === null ||
        request === null ||
        request === undefined ||
        request.kind !== "decision"
      ) {
        return;
      }
      const sessionId = state.campaign.sessionId;
      dispatch({ type: "month-commit-started" });
      const result = await bridge.campaign.execute("answerDecision", {
        sessionId,
        expectedRevision: state.campaign.revision,
        transportRequestId: crypto.randomUUID(),
        interruptionId: request.interruptionId,
        decisionId: request.decisionId ?? "",
        optionId,
      });
      applyResolveResult(result, sessionId);
      // Ticket 07: name the change the choice made (presentation only).
      collectMessage(decisionResultMessage(request, optionId));
    },
    [bridge, state.campaign, state.interruption, applyResolveResult, collectMessage],
  );

  /** Submit the player's answer to a battle request (T-1 owns the offer policy). */
  const submitBattleResult = useCallback(
    async (choice: BattleChoice) => {
      const request = state.interruption?.request;
      if (
        bridge === undefined ||
        state.campaign === null ||
        request === null ||
        request === undefined ||
        request.kind !== "battle"
      ) {
        return;
      }
      const sessionId = state.campaign.sessionId;
      dispatch({ type: "month-commit-started" });
      const result = await bridge.campaign.execute("submitBattleResult", {
        sessionId,
        expectedRevision: state.campaign.revision,
        transportRequestId: crypto.randomUUID(),
        interruptionId: request.interruptionId,
        battleId: request.battleId ?? "",
        winnerId: null,
        loserId: null,
        attackerLosses: [],
        defenderLosses: [],
        damageReport: {},
      });
      applyResolveResult(result, sessionId);
      collectMessage(`Battle ${choice} — delegated to staff.`);
    },
    [bridge, state.campaign, state.interruption, applyResolveResult, collectMessage],
  );

  /** Submit a completed player-fought battle through the battle-result interruption (T-2). */
  const submitPlayerBattleOutcome = useCallback(
    async (outcome: PlayerBattleResultDto) => {
      const request = state.interruption?.request;
      if (
        bridge === undefined ||
        state.campaign === null ||
        request === null ||
        request === undefined ||
        request.kind !== "battle"
      ) {
        return;
      }
      const sessionId = state.campaign.sessionId;
      dispatch({ type: "month-commit-started" });
      const result = await bridge.campaign.execute("submitBattleResult", {
        sessionId,
        expectedRevision: state.campaign.revision,
        transportRequestId: crypto.randomUUID(),
        interruptionId: request.interruptionId,
        battleId: outcome.battleId,
        winnerId: outcome.winnerId,
        loserId: outcome.loserId,
        attackerLosses: outcome.attackerLosses,
        defenderLosses: outcome.defenderLosses,
        damageReport: outcome.damageReport,
      });
      applyResolveResult(result, sessionId);
      collectMessage(
        outcome.winnerId === null
          ? `Battle ${request.battleId ?? ""} ended without a decision.`
          : `Battle ${request.battleId ?? ""} resolved: ${outcome.winnerId} won.`,
      );
    },
    [bridge, state.campaign, state.interruption, applyResolveResult, collectMessage],
  );

  /**
   * Submit the player's answer to a battle offer (T-1 03, T-1 04). It is a typed accept, delegate or decline response, never a battle
   * outcome: a tie is a result, not an answer to an offer (spec #109 decision C). A refused answer leaves the offer open.
   */
  const submitOfferResponse = useCallback(
    async (choice: OfferChoice) => {
      const request = state.interruption?.request;
      if (
        bridge === undefined ||
        state.campaign === null ||
        request === null ||
        request === undefined ||
        request.kind !== "offer"
      ) {
        return;
      }
      const sessionId = state.campaign.sessionId;
      dispatch({ type: "month-commit-started" });
      const result = await bridge.campaign.execute("submitOfferResponse", {
        sessionId,
        expectedRevision: state.campaign.revision,
        transportRequestId: crypto.randomUUID(),
        interruptionId: request.interruptionId,
        battleId: request.battleId ?? "",
        response: choice,
      });
      applyResolveResult(result, sessionId);
      if (result.outcome === "success") {
        const areaId = request.areaId ?? "";
        // A decline reports its victory-point cost when the month completed and the turn summary carries it (the
        // authoritative BattleDeclined event projected as a message); otherwise it is reported without the figure.
        const declined =
          choice === "decline" && result.value.status === "completed"
            ? result.value.summary.messages.find(
                (message) =>
                  message.bodyKey === "messages.battle.declined.body" &&
                  message.interpolation["battleId"] === request.battleId,
              )
            : undefined;
        const cost = declined?.interpolation["victoryPointCost"];
        collectMessage(
          cost === undefined
            ? offerText(`ui.offer.result.${choice}`, { areaId })
            : offerText("ui.offer.result.decline.cost", {
                areaId,
                victoryPointCost: String(cost),
              }),
        );
      }
    },
    [bridge, state.campaign, state.interruption, applyResolveResult, collectMessage],
  );

  const abandonPendingTurn = useCallback(async () => {
    if (bridge === undefined || state.campaign === null) return;
    const sessionId = state.campaign.sessionId;
    const result = await bridge.campaign.execute("abandonPendingTurn", sessionId);
    if (result.outcome === "success") {
      setInterruption(null);
      collectMessage("Outstanding turn discarded.");
    } else {
      collectMessage(`Could not discard the outstanding turn: ${result.reason}.`);
    }
  }, [bridge, state.campaign, setInterruption, collectMessage]);

  const setPrimaryAction = useCallback(
    (action: PrimaryAction | null) => dispatch({ type: "primary-action-changed", action }),
    [],
  );
  const goBackInHistory = useCallback(
    () => dispatch({ type: "history-replaced", history: goBack(state.history) }),
    [state.history],
  );
  const goForwardInHistory = useCallback(
    () => dispatch({ type: "history-replaced", history: goForward(state.history) }),
    [state.history],
  );

  return useMemo(
    () => ({
      campaign: state.campaign,
      loading: state.loading,
      error: state.error,
      saving: state.saving,
      saveMessage: state.saveMessage,
      primaryAction: state.primaryAction,
      committing: state.committing,
      interruption: state.interruption,
      mode: campaignShellMode(state),
      screen: currentShellScreen(state),
      canGoBack: canGoBack(state.history),
      canGoForward: canGoForward(state.history),
      openCampaign,
      closeCampaign,
      saveCampaign,
      copyCampaign,
      advanceMonth,
      answerDecision,
      submitBattleResult,
      submitPlayerBattleOutcome,
      submitOfferResponse,
      abandonPendingTurn,
      refreshCampaign,
      selectScreen,
      setPrimaryAction,
      goBack: goBackInHistory,
      goForward: goForwardInHistory,
    }),
    [
      state,
      openCampaign,
      closeCampaign,
      saveCampaign,
      copyCampaign,
      advanceMonth,
      answerDecision,
      submitBattleResult,
      submitPlayerBattleOutcome,
      submitOfferResponse,
      abandonPendingTurn,
      refreshCampaign,
      selectScreen,
      setPrimaryAction,
      goBackInHistory,
      goForwardInHistory,
    ],
  );
}
