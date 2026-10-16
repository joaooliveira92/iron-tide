import { createContext, type ReactNode, use, useMemo } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { useCampaignShell } from "./useCampaignShell.js";
import { useCampaignShell as useCampaignShellState } from "./useCampaignShell.js";

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
    | "answerDecision"
    | "submitBattleResult"
    | "abandonPendingTurn"
    | "refreshCampaign"
    | "selectScreen"
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
        answerDecision: shell.answerDecision,
        submitBattleResult: shell.submitBattleResult,
        abandonPendingTurn: shell.abandonPendingTurn,
        refreshCampaign: shell.refreshCampaign,
        selectScreen: shell.selectScreen,
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

/**
 * The active campaign's committed revision (turn number), or null when no campaign
 * is open or the hook is used outside the shell. Unlike `useCampaignShellContext` it
 * never throws, so screen hooks stay usable in isolation (tests, previews). A screen
 * passes it as `refreshKey` so it reloads when the month is advanced elsewhere.
 */
export function useCampaignRevision(): number | null {
  const context = use(CampaignShellContext);
  return context?.state.campaign?.revision ?? null;
}

/**
 * The active campaign's current month as `YYYY-MM`, or null outside a campaign. Used where rules depend on the
 * campaign date (technology availability for ship design).
 */
export function useCampaignMonthId(): string | null {
  const context = use(CampaignShellContext);
  const month = context?.state.campaign?.month;
  return month ? `${month.year}-${String(month.month).padStart(2, "0")}` : null;
}
