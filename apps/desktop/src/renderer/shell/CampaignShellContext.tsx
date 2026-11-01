import { createContext, type ReactNode, use, useEffect, useMemo, useRef } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { ActiveCampaignCurrencyContext } from "../lib/presentation-format/index.js";
import type { useCampaignShell } from "./useCampaignShell.js";
import { useCampaignShell as useCampaignShellState } from "./useCampaignShell.js";
import type { LeaveGuard, LeaveTarget } from "./campaign-screen-types.js";

type CampaignShell = ReturnType<typeof useCampaignShell>;

export interface CampaignShellContextValue {
  readonly state: Pick<
    CampaignShell,
    | "campaign"
    | "loading"
    | "error"
    | "saving"
    | "saveMessage"
    | "primaryAction"
    | "committing"
    | "interruption"
    | "commitFailure"
    | "revisionProjectId"
    | "reads"
    | "mode"
    | "screen"
    | "canGoBack"
    | "canGoForward"
  >;
  readonly actions: Pick<
    CampaignShell,
    | "openCampaign"
    | "closeCampaign"
    | "saveCampaign"
    | "copyCampaign"
    | "advanceMonth"
    | "answerInterruption"
    | "abandonPendingTurn"
    | "refreshCampaign"
    | "selectScreen"
    | "reviseProject"
    | "clearRevision"
    | "setLeaveGuard"
    | "setPrimaryAction"
    | "goBack"
    | "goForward"
  >;
  readonly meta: {
    readonly bridgeAvailable: boolean;
  };
}

const CampaignShellStateContext = createContext<CampaignShellContextValue["state"] | null>(null);
const CampaignShellActionsContext = createContext<CampaignShellContextValue["actions"] | null>(
  null,
);
const CampaignShellMetaContext = createContext<CampaignShellContextValue["meta"] | null>(null);

export function CampaignShellProvider({
  bridge,
  children,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly children: ReactNode;
}) {
  const shell = useCampaignShellState(bridge);
  const state = useMemo(
    () => ({
      campaign: shell.campaign,
      loading: shell.loading,
      error: shell.error,
      saving: shell.saving,
      saveMessage: shell.saveMessage,
      primaryAction: shell.primaryAction,
      committing: shell.committing,
      interruption: shell.interruption,
      commitFailure: shell.commitFailure,
      revisionProjectId: shell.revisionProjectId,
      reads: shell.reads,
      mode: shell.mode,
      screen: shell.screen,
      canGoBack: shell.canGoBack,
      canGoForward: shell.canGoForward,
    }),
    [
      shell.campaign,
      shell.loading,
      shell.error,
      shell.saving,
      shell.saveMessage,
      shell.primaryAction,
      shell.committing,
      shell.interruption,
      shell.commitFailure,
      shell.revisionProjectId,
      shell.reads,
      shell.mode,
      shell.screen,
      shell.canGoBack,
      shell.canGoForward,
    ],
  );
  const actions = useMemo(
    () => ({
      openCampaign: shell.openCampaign,
      closeCampaign: shell.closeCampaign,
      saveCampaign: shell.saveCampaign,
      copyCampaign: shell.copyCampaign,
      advanceMonth: shell.advanceMonth,
      answerInterruption: shell.answerInterruption,
      abandonPendingTurn: shell.abandonPendingTurn,
      refreshCampaign: shell.refreshCampaign,
      selectScreen: shell.selectScreen,
      reviseProject: shell.reviseProject,
      clearRevision: shell.clearRevision,
      setLeaveGuard: shell.setLeaveGuard,
      setPrimaryAction: shell.setPrimaryAction,
      goBack: shell.goBack,
      goForward: shell.goForward,
    }),
    [
      shell.openCampaign,
      shell.closeCampaign,
      shell.saveCampaign,
      shell.copyCampaign,
      shell.advanceMonth,
      shell.answerInterruption,
      shell.abandonPendingTurn,
      shell.refreshCampaign,
      shell.selectScreen,
      shell.reviseProject,
      shell.clearRevision,
      shell.setLeaveGuard,
      shell.setPrimaryAction,
      shell.goBack,
      shell.goForward,
    ],
  );
  const meta = useMemo(() => ({ bridgeAvailable: bridge !== undefined }), [bridge]);

  return (
    <CampaignShellActionsContext.Provider value={actions}>
      <CampaignShellMetaContext.Provider value={meta}>
        <CampaignShellStateContext.Provider value={state}>
          {children}
        </CampaignShellStateContext.Provider>
      </CampaignShellMetaContext.Provider>
    </CampaignShellActionsContext.Provider>
  );
}

export function useCampaignShellActions(): CampaignShellContextValue["actions"] {
  const actions = use(CampaignShellActionsContext);
  if (actions === null) {
    throw new BluewaveError("CAMPAIGN_SHELL_ACTIONS_MISSING", {
      hook: "useCampaignShellActions",
    });
  }
  return actions;
}

export function useCampaignShellContext(): CampaignShellContextValue {
  const state = use(CampaignShellStateContext);
  const actions = use(CampaignShellActionsContext);
  const meta = use(CampaignShellMetaContext);
  const value = useMemo(
    () => (state === null || actions === null || meta === null ? null : { state, actions, meta }),
    [state, actions, meta],
  );
  if (value === null) {
    throw new Error("useCampaignShellContext must be used within CampaignShellProvider");
  }
  return value;
}

export function useCampaignRevision(): number | null {
  return use(CampaignShellStateContext)?.campaign?.revision ?? null;
}

export function useCampaignMonthId(): string | null {
  const month = use(CampaignShellStateContext)?.campaign?.month;
  return month ? `${month.year}-${String(month.month).padStart(2, "0")}` : null;
}

export function useActiveCampaignCurrencyContext(): ActiveCampaignCurrencyContext {
  const campaign = use(CampaignShellStateContext)?.campaign;
  if (campaign === null || campaign === undefined) return {};
  return campaign.playerNationId !== undefined
    ? { nationId: campaign.playerNationId, year: campaign.month.year }
    : { year: campaign.month.year };
}

export function useRevisionRequest(): {
  readonly projectId: string | null;
  readonly clear: () => void;
} {
  const projectId = use(CampaignShellStateContext)?.revisionProjectId ?? null;
  const clear = use(CampaignShellActionsContext)?.clearRevision ?? NOOP;
  return { projectId, clear };
}

export function useLeaveGuard(guard: LeaveGuard): (target: LeaveTarget) => void {
  const actions = use(CampaignShellActionsContext);
  const latest = useRef(guard);
  latest.current = guard;
  const bypass = useRef(false);
  const setGuard = actions?.setLeaveGuard;
  useEffect(() => {
    if (setGuard === undefined) return;
    setGuard((target) => bypass.current || latest.current(target));
    return () => setGuard(null);
  }, [setGuard]);
  return (target) => {
    bypass.current = true;
    if (actions === null) return;
    if (target === "back") actions.goBack();
    else if (target === "forward") actions.goForward();
    else actions.selectScreen(target);
  };
}

function NOOP(): void {}

export function useReviseProject(): (projectId: string) => void {
  return use(CampaignShellActionsContext)?.reviseProject ?? NOOP;
}
