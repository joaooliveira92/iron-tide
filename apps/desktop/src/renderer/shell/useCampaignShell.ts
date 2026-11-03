import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { resolveMessage } from "../content/uiCatalogue.js";
import { envelopeOf, stampCommand } from "../lib/command-envelope.js";
import { emitWideEvent } from "../lib/telemetry.js";
import type { Screen } from "./campaign-screen-registry.js";
import type { LeaveGuard, LeaveTarget } from "./campaign-screen-types.js";
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshGenerationRef = useRef(0);
  const [reads, setReads] = useState<CampaignReads | null>(null);

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
            message: resolveMessage("shell.campaign.inspectionFailed", {
              reason: campaignReads.projection.reason,
            }),
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
        void bridge.campaign
          .execute("readPendingTurn", sessionId)
          .then((pending) => {
            if (pending.outcome === "success" && pending.value.pending !== null) {
              dispatch({
                type: "interruption-set",
                interruption: {
                  request: null,
                  pending: pending.value.pending,
                  unavailable: !pending.value.valid,
                },
              });
            }
          })
          .catch(() => undefined);
      } catch (error) {
        dispatch({
          type: "campaign-open-failed",
          message:
            error instanceof Error ? error.message : resolveMessage("shell.campaign.unknownError"),
        });
      }
    },
    [bridge],
  );

  const closeCampaign = useCallback(async () => {
    const campaign = stateRef.current.campaign;
    if (bridge === undefined || campaign === null) return;
    const started = performance.now();
    const result = await bridge.campaign.execute("closeCampaign", campaign.sessionId);
    const duration = Math.round(performance.now() - started);
    if (result.outcome === "success" || result.reason === "SESSION_NOT_FOUND") {
      emitWideEvent("campaign_close", campaign.sessionId, duration, "success");
      refreshGenerationRef.current += 1;
      setReads(null);
      dispatch({ type: "campaign-closed" });
      return;
    }
    emitWideEvent("campaign_close", campaign.sessionId, duration, "rejected", [result.reason]);
    collectMessage(resolveMessage("shell.campaign.closeFailed", { reason: result.reason }));
  }, [bridge]);

  const saveCampaign = useCallback(async () => {
    const campaign = stateRef.current.campaign;
    if (bridge === undefined || campaign === null) return;
    dispatch({ type: "save-started" });
    const result = await bridge.campaign.execute("saveCampaign", campaign.sessionId);
    collectMessage(
      result.outcome === "success"
        ? resolveMessage("shell.campaign.saved", { revision: result.value.revision })
        : result.reason === "CANCELLED"
          ? null
          : resolveMessage("shell.campaign.saveFailed", {
              reason: result.reason,
              diagnostics: diagnosticsSuffix(result.diagnostics),
            }),
    );
  }, [bridge]);

  const copyCampaign = useCallback(async () => {
    const campaign = stateRef.current.campaign;
    if (bridge === undefined || campaign === null) return;
    dispatch({ type: "save-started" });
    const result = await bridge.campaign.execute("copyCampaign", campaign.sessionId);
    collectMessage(
      result.outcome === "success"
        ? resolveMessage("shell.campaign.copySaved", { location: result.value.location })
        : result.reason === "SAVE_LOCATION_CANCELLED"
          ? null
          : resolveMessage("shell.campaign.copyFailed", {
              reason: result.reason,
              diagnostics: diagnosticsSuffix(result.diagnostics),
            }),
    );
  }, [bridge]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const leaveGuardRef = useRef<LeaveGuard | null>(null);
  const setLeaveGuard = useCallback((guard: LeaveGuard | null) => {
    leaveGuardRef.current = guard;
  }, []);
  const mayLeave = useCallback((target: LeaveTarget) => {
    const guard = leaveGuardRef.current;
    return guard === null || guard(target);
  }, []);
  const selectScreen = useCallback(
    (screen: Screen) => {
      if (mayLeave(screen)) dispatch({ type: "visit", screen });
    },
    [mayLeave],
  );
  const reviseProject = useCallback(
    (projectId: string) => dispatch({ type: "revision-requested", projectId }),
    [],
  );
  const clearRevision = useCallback(() => dispatch({ type: "revision-cleared" }), []);

  const refreshCampaign = useCallback(
    async (sessionIdOverride?: string) => {
      const sessionId = sessionIdOverride ?? stateRef.current.campaign?.sessionId;
      if (bridge === undefined || sessionId === undefined) return;
      const generation = ++refreshGenerationRef.current;
      const campaignReads = await readCampaign(bridge.campaign, sessionId);
      if (campaignReads.projection.status !== "ready") return;
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
    [bridge],
  );

  const setInterruption = useCallback((interruption: ShellInterruption | null) => {
    dispatch(
      interruption === null
        ? { type: "interruption-cleared" }
        : { type: "interruption-set", interruption },
    );
  }, []);

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
    const { campaign, interruption } = stateRef.current;
    if (bridge === undefined || campaign === null) return;
    if (interruption?.request != null) return;
    dispatch({ type: "month-commit-started" });
    const sessionId = campaign.sessionId;
    const started = performance.now();
    try {
      const result = await bridge.campaign.execute(
        "resolveTurn",
        envelopeOf(sessionId, stampCommand("resolveTurn", campaign.revision)),
      );
      const duration = Math.round(performance.now() - started);
      emitWideEvent(
        "campaign_month_advance",
        sessionId,
        duration,
        result.outcome === "success" ? "success" : "rejected",
        result.outcome === "success" ? [] : [result.reason],
      );
      applyResolveOutcome(foldResolveTurn(result, campaign, sessionId), sessionId, null);
    } catch (error) {
      emitWideEvent("campaign_month_advance", sessionId, 0, "rejected", [
        error instanceof Error ? error.message : resolveMessage("shell.campaign.unknownError"),
      ]);
      dispatch({
        type: "month-commit-failed",
        failure: {
          _tag: "TransportFailure",
          message:
            error instanceof Error ? error.message : resolveMessage("shell.month.advanceFailed"),
        },
      });
    }
  }, [bridge, applyResolveOutcome]);

  const answerInterruption = useCallback(
    async (answer: InterruptionAnswer): Promise<InterruptionAnswerOutcome> => {
      const { campaign, interruption } = stateRef.current;
      const request = interruption?.request;
      if (bridge === undefined || campaign === null) {
        return { _tag: "NotSent", reason: { _tag: "NoCampaign" } };
      }
      if (request === null || request === undefined) {
        return { _tag: "NotSent", reason: { _tag: "NoOutstandingRequest" } };
      }
      const plan = planInterruptionAnswer(campaign, request, answer);
      if ("_tag" in plan) {
        return { _tag: "NotSent", reason: plan };
      }
      dispatch({ type: "month-commit-started" });
      const sessionId = campaign.sessionId;
      const result = await sendInterruptionAnswer(bridge.campaign, plan);
      const { outcome, message } = foldInterruptionAnswer(
        result,
        request,
        answer,
        campaign,
        sessionId,
      );
      applyResolveOutcome(outcome, sessionId, message);
      return { _tag: "Sent", outcome };
    },
    [bridge, applyResolveOutcome],
  );

  const abandonPendingTurn = useCallback(async () => {
    const campaign = stateRef.current.campaign;
    if (bridge === undefined || campaign === null) return;
    const sessionId = campaign.sessionId;
    const result = await bridge.campaign.execute("abandonPendingTurn", sessionId);
    if (result.outcome === "success") {
      setInterruption(null);
      collectMessage(resolveMessage("shell.turn.discarded"));
    } else {
      collectMessage(resolveMessage("shell.turn.discardFailed", { reason: result.reason }));
    }
  }, [bridge, setInterruption, collectMessage]);

  const setPrimaryAction = useCallback(
    (action: PrimaryAction | null) => dispatch({ type: "primary-action-changed", action }),
    [],
  );
  const goBackInHistory = useCallback(() => {
    if (mayLeave("back"))
      dispatch({ type: "history-replaced", history: goBack(stateRef.current.history) });
  }, [mayLeave]);
  const goForwardInHistory = useCallback(() => {
    if (mayLeave("forward"))
      dispatch({ type: "history-replaced", history: goForward(stateRef.current.history) });
  }, [mayLeave]);

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
      revisionProjectId: state.revisionProjectId,
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
      reviseProject,
      clearRevision,
      setLeaveGuard,
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
      reviseProject,
      clearRevision,
      setLeaveGuard,
      setPrimaryAction,
      goBackInHistory,
      goForwardInHistory,
    ],
  );
}
