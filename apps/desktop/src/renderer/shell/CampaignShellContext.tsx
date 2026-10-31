import { createContext, type ReactNode, use, useEffect, useMemo, useRef } from "react";
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

const CampaignShellContext = createContext<CampaignShellContextValue | null>(null);

export function CampaignShellProvider({
  bridge,
  children,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly children: ReactNode;
}) {
  const shell = useCampaignShellState(bridge);
  const value = useMemo<CampaignShellContextValue>(
    () => ({
      state: {
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
      },
      actions: {
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
      },
      meta: { bridgeAvailable: bridge !== undefined },
    }),
    [bridge, shell],
  );

  return <CampaignShellContext.Provider value={value}>{children}</CampaignShellContext.Provider>;
}

export function useCampaignShellContext(): CampaignShellContextValue {
  const context = use(CampaignShellContext);
  if (context === null) {
    throw new Error("useCampaignShellContext must be used within CampaignShellProvider");
  }
  return context;
}

export function useCampaignRevision(): number | null {
  const context = use(CampaignShellContext);
  return context?.state.campaign?.revision ?? null;
}

export function useCampaignMonthId(): string | null {
  const context = use(CampaignShellContext);
  const month = context?.state.campaign?.month;
  return month ? `${month.year}-${String(month.month).padStart(2, "0")}` : null;
}

export function useActiveCampaignCurrencyContext(): ActiveCampaignCurrencyContext {
  const context = use(CampaignShellContext);
  const campaign = context?.state.campaign;
  if (campaign === null || campaign === undefined) return {};
  return campaign.playerNationId !== undefined
    ? { nationId: campaign.playerNationId, year: campaign.month.year }
    : { year: campaign.month.year };
}

export function useRevisionRequest(): {
  readonly projectId: string | null;
  readonly clear: () => void;
} {
  const context = use(CampaignShellContext);
  return {
    projectId: context?.state.revisionProjectId ?? null,
    clear: context?.actions.clearRevision ?? NOOP,
  };
}

export function useLeaveGuard(guard: LeaveGuard): (target: LeaveTarget) => void {
  const context = use(CampaignShellContext);
  const actions = context?.actions;
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
    if (actions === undefined) return;
    if (target === "back") actions.goBack();
    else if (target === "forward") actions.goForward();
    else actions.selectScreen(target);
  };
}

function NOOP(): void {}

export function useReviseProject(): (projectId: string) => void {
  const context = use(CampaignShellContext);
  return context?.actions.reviseProject ?? NOOP;
}
