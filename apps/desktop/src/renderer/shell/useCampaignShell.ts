import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { createTransportRequestId } from "../lib/command-screen-workflow.js";
import { emitWideEvent } from "../lib/telemetry.js";
import type { Screen } from "./campaign-screen-registry.js";
import { overviewFromProjection } from "./campaign-overview.js";
import { activeAlertsCount, readCampaign, type CampaignReads } from "./campaign-reads.js";
import {
  campaignShellMode,
  currentShellScreen,
  diagnosticsSuffix,
  initialCampaignShellState,
  reduceCampaignShell,
  type ShellInterruption,
} from "./campaign-shell-state.js";
import {
  foldInterruptionAnswer,
  foldResolveTurn,
  planInterruptionAnswer,
  sendInterruptionAnswer,
  type InterruptionAnswer,
  type InterruptionAnswerOutcome,
  type ResolveOutcome,
} from "./interruption-answer.js";
import { canGoBack, canGoForward, goBack, goForward } from "./navigation-history.js";
import type { PrimaryAction } from "./primary-action.js";

const SAVE_MESSAGE_DURATION_MS = 8_000;

export function useCampaignShell(bridge: BluewaveDesktopBridge | undefined) {
  const [state, dispatch] = useReducer(reduceCampaignShell, undefined, initialCampaignShellState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped whenever the campaign is closed or a newer refresh starts, so a response that
  // arrives late (out of order, or after Close) is dropped instead of overwriting newer state.
  const refreshGenerationRef = useRef(0);
  const [reads, setReads] = useState<CampaignReads | null>(null);

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
        const campaignReads = await readCampaign(bridge.campaign, sessionId);
        const duration = Math.round(performance.now() - started);
        if (campaignReads.projection.status !== "ready") {
          emitWideEvent("campaign_open", sessionId, duration, "rejected", [
            campaignReads.projection.reason,
          ]);
          dispatch({
            type: "campaign-open-failed",
            message: `Inspection failed: ${campaignReads.projection.reason}`,
          });
          return;
        }
        emitWideEvent("campaign_open", sessionId, duration, "success");
        dispatch({
          type: "campaign-opened",
          campaign: overviewFromProjection(
            sessionId,
            campaignReads.projection.value,
            activeAlertsCount(campaignReads),
          ),
        });
        setReads(campaignReads);
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
      setReads(null);
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
      const campaignReads = await readCampaign(bridge.campaign, sessionId);
      if (campaignReads.projection.status !== "ready") return;
      // A newer refresh started, or the campaign was closed, while we waited: drop this one.
      if (generation !== refreshGenerationRef.current) return;
      dispatch({
        type: "campaign-refreshed",
        campaign: overviewFromProjection(
          sessionId,
          campaignReads.projection.value,
          activeAlertsCount(campaignReads),
        ),
      });
      setReads(campaignReads);
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
   * Apply a folded `resolveTurn` outcome: a completed turn updates the header and
   * clears the interruption; a suspended/unavailable turn opens its prompt; a
   * failure records the tagged failure and shows it instead of any answer line.
   */
  const applyResolveOutcome = useCallback(
    (outcome: ResolveOutcome, sessionId: string, answerMessage: string | null): void => {
      switch (outcome._tag) {
        case "Completed":
          if (outcome.campaign !== null) {
            dispatch({ type: "month-committed", campaign: outcome.campaign });
          }
          setInterruption(null);
          void refreshCampaign(sessionId);
          collectMessage(answerMessage ?? outcome.message);
          return;
        case "Suspended":
          setInterruption(outcome.interruption);
          break;
        case "Unavailable":
          setInterruption({ request: null, pending: null, unavailable: true });
          break;
        case "Failed":
          dispatch({ type: "month-commit-failed", failure: outcome.failure });
          return;
      }
      if (answerMessage !== null) collectMessage(answerMessage);
    },
    [refreshCampaign, setInterruption, collectMessage],
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
        transportRequestId: createTransportRequestId("resolveTurn"),
      });
      const duration = Math.round(performance.now() - started);
      emitWideEvent(
        "campaign_month_advance",
        sessionId,
        duration,
        result.outcome === "success" ? "success" : "rejected",
        result.outcome === "success" ? [] : [result.reason],
      );
      applyResolveOutcome(foldResolveTurn(result, state.campaign, sessionId), sessionId, null);
    } catch (error) {
      emitWideEvent("campaign_month_advance", sessionId, 0, "rejected", [
        error instanceof Error ? error.message : "Unknown error",
      ]);
      dispatch({
        type: "month-commit-failed",
        failure: {
          _tag: "TransportFailure",
          message: error instanceof Error ? error.message : "Could not advance month.",
        },
      });
    }
  }, [bridge, state.campaign, state.interruption, applyResolveOutcome]);

  /**
   * Answer the outstanding interruption with a typed answer. The plan assembles
   * the envelope and transport identity, the fold maps the reply back, and the
   * outcome is applied once — so every interruption kind shares this one path.
   */
  const answerInterruption = useCallback(
    async (answer: InterruptionAnswer): Promise<InterruptionAnswerOutcome> => {
      const request = state.interruption?.request;
      if (bridge === undefined || state.campaign === null) {
        return { _tag: "NotSent", reason: { _tag: "NoCampaign" } };
      }
      if (request === null || request === undefined) {
        return { _tag: "NotSent", reason: { _tag: "NoOutstandingRequest" } };
      }
      const plan = planInterruptionAnswer(state.campaign, request, answer);
      if ("_tag" in plan) {
        return { _tag: "NotSent", reason: plan };
      }
      dispatch({ type: "month-commit-started" });
      const sessionId = state.campaign.sessionId;
      const result = await sendInterruptionAnswer(bridge.campaign, plan);
      const { outcome, message } = foldInterruptionAnswer(
        result,
        request,
        answer,
        state.campaign,
        sessionId,
      );
      applyResolveOutcome(outcome, sessionId, message);
      return { _tag: "Sent", outcome };
    },
    [bridge, state.campaign, state.interruption, applyResolveOutcome],
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
      commitFailure: state.commitFailure,
      reads,
      mode: campaignShellMode(state),
      screen: currentShellScreen(state),
      canGoBack: canGoBack(state.history),
      canGoForward: canGoForward(state.history),
      openCampaign,
      closeCampaign,
      saveCampaign,
      copyCampaign,
      advanceMonth,
      answerInterruption,
      abandonPendingTurn,
      refreshCampaign,
      selectScreen,
      setPrimaryAction,
      goBack: goBackInHistory,
      goForward: goForwardInHistory,
    }),
    [
      state,
      reads,
      openCampaign,
      closeCampaign,
      saveCampaign,
      copyCampaign,
      advanceMonth,
      answerInterruption,
      abandonPendingTurn,
      refreshCampaign,
      selectScreen,
      setPrimaryAction,
      goBackInHistory,
      goForwardInHistory,
    ],
  );
}
