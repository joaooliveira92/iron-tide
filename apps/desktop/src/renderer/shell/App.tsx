import { useEffect, useMemo, useState } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { WindowState } from "../../shared/bridge-contract.js";
import {
  MonthlyResolutionFailure,
  MonthlyResolutionLoading,
} from "../components/MonthlyResolutionLoading.js";
import {
  CHOOSE_YOUR_ARCHETYPE_HEADING,
  CHOOSE_YOUR_ARCHETYPE_HINT,
} from "../screens/new-game/choose-your-archetype-content.js";
import {
  RULES_OF_THE_NAVAL_AGE_HEADING,
  RULES_OF_THE_NAVAL_AGE_HINT,
} from "../screens/new-game/rules-of-the-naval-age-content.js";
import { PreTurnReviewDialog } from "../components/PreTurnReviewDialog.js";
import { PresentationContentGate } from "../content/PresentationContentGate.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import {
  CAMPAIGN_SCREEN_SEARCH_TARGETS,
  CampaignScreenOutlet,
  type Screen,
} from "./campaign-screen-registry.js";
import type { CampaignShellMode } from "./campaign-shell-state.js";
import { AppFrame } from "./AppFrame.js";
import { BackgroundLayer } from "./BackgroundLayer.js";
import { useBackground } from "./BackgroundContext.js";
import { CampaignUnavailableView } from "./CampaignUnavailableView.js";
import { CampaignShellProvider, useCampaignShellContext } from "./CampaignShellContext.js";
import { GuidedInspectionOverlay } from "./GuidedInspectionOverlay.js";
import { BattleRequestDialog } from "./interruptions/BattleRequestDialog.js";
import { OfferDialog } from "./interruptions/OfferDialog.js";
import { DecisionDialog } from "./interruptions/DecisionDialog.js";
import { PendingTurnRecoveryPrompt } from "./interruptions/PendingTurnRecoveryPrompt.js";
import { MapSheet } from "./MapSheet.js";
import { SiteHeader } from "./SiteHeader.js";
import {
  type ActiveView,
  type HeaderCampaign,
  type WizardStepCopy,
  headerTitleFor,
} from "./site-header-state.js";
import { useGuidedInspection } from "./useGuidedInspection.js";
import { useTheme } from "./ThemeContext.js";
import { WindowContextProvider } from "./WindowContext.js";

const EMPTY_SEARCH_TARGETS: readonly {
  readonly id: Screen;
  readonly label: string;
}[] = [];

declare global {
  interface Window {
    bluewave?: BluewaveDesktopBridge;
  }
}

/**
 * The shell variants that present the new-campaign workflow. Kept as data so a
 * new step only has to be added here (and to `CampaignUnavailableView`'s
 * renderer registry) rather than to an inline `||` chain.
 */
const NEW_GAME_MODE_KINDS: ReadonlySet<CampaignShellMode["kind"]> = new Set([
  "new-game-nation",
  "new-game-preferences",
  "new-game-archetype",
  "new-game-identity",
  "new-game-fleet-method",
  "new-game-review",
  "new-game-launching",
  "opening-briefing",
]);

/**
 * New-game steps that name themselves in the header's secondary row instead of
 * the generic "Campaign setup assistant" copy. Steps absent here keep it.
 */
const WIZARD_STEP_COPY: Partial<Record<CampaignShellMode["kind"], WizardStepCopy>> = {
  "new-game-preferences": {
    heading: RULES_OF_THE_NAVAL_AGE_HEADING,
    hint: RULES_OF_THE_NAVAL_AGE_HINT,
  },
  "new-game-archetype": {
    heading: CHOOSE_YOUR_ARCHETYPE_HEADING,
    hint: CHOOSE_YOUR_ARCHETYPE_HINT,
  },
};

function activeViewFor(mode: CampaignShellMode): ActiveView {
  if (mode.kind === "campaign") return "playing";
  return NEW_GAME_MODE_KINDS.has(mode.kind) ? "new_game" : "menu";
}

function ActiveCampaignView({ screen }: { readonly screen: Screen }) {
  return (
    // The Overview is the full-bleed command screen (CC-2): no page padding, so the map fills the space.
    <div className={screen === "overview" ? "h-full font-sans" : "p-8 font-sans"}>
      <CampaignScreenOutlet screen={screen} />
    </div>
  );
}

function CampaignShellApplication({
  bridge,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
}) {
  const { resolvedTheme } = useTheme();
  const { background } = useBackground();
  const shell = useCampaignShellContext();
  const [windowState, setWindowState] = useState<WindowState | null>(null);

  useEffect(() => {
    let active = true;
    async function loadWindowState(): Promise<void> {
      if (bridge === undefined) return;
      try {
        const state = await bridge.getWindowState();
        if (active) setWindowState(state);
      } catch {
        // Keep the platform-derived fallback when IPC is temporarily unavailable.
      }
    }
    void loadWindowState();
    return () => {
      active = false;
    };
  }, [bridge]);

  const platform = bridge?.platform ?? "darwin";
  const headerCampaign: HeaderCampaign | null = useMemo(
    () =>
      shell.state.campaign === null
        ? null
        : {
            month: shell.state.campaign.month,
            treasury: shell.state.campaign.treasury,
            nationName: shell.state.campaign.nationName,
            projectedSurplusDeficit: shell.state.campaign.projectedSurplusDeficit,
            atWar: shell.state.campaign.atWar,
            activeAlertsCount: shell.state.campaign.activeAlertsCount,
          },
    [shell.state.campaign],
  );

  const windowContextValue = useMemo(
    () => ({
      platform,
      windowState: windowState ?? {
        platform,
        isMaximized: false,
        maximizable: true,
        minimizable: true,
      },
      titlebar: { title: headerTitleFor(headerCampaign) },
      windowMinimize: () => bridge?.windowMinimize(),
      windowMaximizeToggle: () => bridge?.windowMaximizeToggle(),
      windowClose: () => bridge?.windowClose(),
    }),
    [bridge, headerCampaign, platform, windowState],
  );

  const [reviewOpen, setReviewOpen] = useState(false);

  const activeView = activeViewFor(shell.state.mode);
  const searchTargets =
    shell.state.campaign === null ? EMPTY_SEARCH_TARGETS : CAMPAIGN_SCREEN_SEARCH_TARGETS;

  const header = (
    <SiteHeader
      title={headerTitleFor(headerCampaign)}
      activeView={activeView}
      campaign={headerCampaign}
      wizardStep={WIZARD_STEP_COPY[shell.state.mode.kind]}
      back={{
        disabled: !shell.state.canGoBack,
        onTrigger: shell.actions.goBack,
      }}
      forward={{
        disabled: !shell.state.canGoForward,
        onTrigger: shell.actions.goForward,
      }}
      {...(shell.state.primaryAction !== null ? { continueAction: shell.state.primaryAction } : {})}
      searchTargets={searchTargets}
      onSearchNavigate={(id) => shell.actions.selectScreen(id as Screen)}
      onAdvanceMonth={shell.state.campaign !== null ? () => setReviewOpen(true) : undefined}
      advancingMonth={shell.state.committing}
      advanceDisabled={shell.state.interruption !== null}
      campaignMenu={{
        saving: shell.state.saving,
        onSave: shell.actions.saveCampaign,
        onCopy: shell.actions.copyCampaign,
        onCloseCampaign: shell.actions.closeCampaign,
      }}
    />
  );

  const content =
    shell.state.mode.kind !== "campaign" ? (
      <CampaignUnavailableView bridge={bridge} />
    ) : (
      <ActiveCampaignView screen={shell.state.screen} />
    );

  const guidedSessionId =
    shell.state.mode.kind === "campaign" ? shell.state.mode.campaign.sessionId : null;
  const guided = useGuidedInspection({ sessionId: guidedSessionId });

  return (
    <WindowContextProvider value={windowContextValue}>
      <BackgroundLayer background={background} resolvedTheme={resolvedTheme} />
      <AppFrame
        campaignSessionId={shell.state.campaign?.sessionId ?? null}
        campaignRevision={shell.state.campaign?.revision ?? null}
        activeAlertsCount={shell.state.campaign?.activeAlertsCount ?? null}
        screen={shell.state.screen}
        saveMessage={shell.state.saveMessage}
        header={header}
        onSelectScreen={shell.actions.selectScreen}
      >
        {content}
      </AppFrame>
      <MapSheet />
      <MonthlyResolutionLoading committing={shell.state.committing} />
      {shell.state.saveMessage !== null &&
        shell.state.saveMessage.startsWith("Could not advance month:") && (
          <MonthlyResolutionFailure
            message={shell.state.saveMessage}
            onReturn={() => shell.actions.selectScreen("overview")}
            onRetry={async () => {
              // saveMessage is cleared on next commit attempt via month-commit-started
              await shell.actions.advanceMonth();
            }}
          />
        )}
      {shell.state.campaign !== null && (
        <PreTurnReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          sessionId={shell.state.campaign.sessionId}
          campaign={shell.state.campaign}
          saving={shell.state.saving}
          saveMessage={shell.state.saveMessage}
          committing={shell.state.committing}
          onAdvance={async () => {
            setReviewOpen(false);
            await shell.actions.advanceMonth();
          }}
        />
      )}
      {shell.state.campaign !== null &&
        shell.state.interruption !== null &&
        (shell.state.interruption.unavailable ? (
          <PendingTurnRecoveryPrompt
            pending={shell.state.interruption.pending}
            unavailable
            onResume={() => undefined}
            onAbandon={shell.actions.abandonPendingTurn}
          />
        ) : shell.state.interruption.request === null ? (
          <PendingTurnRecoveryPrompt
            pending={shell.state.interruption.pending}
            unavailable={false}
            onResume={shell.actions.advanceMonth}
            onAbandon={shell.actions.abandonPendingTurn}
          />
        ) : shell.state.interruption.request.kind === "decision" ? (
          <DecisionDialog
            request={shell.state.interruption.request}
            onAnswer={shell.actions.answerDecision}
            onAbandon={shell.actions.abandonPendingTurn}
          />
        ) : shell.state.interruption.request.kind === "offer" ? (
          <OfferDialog
            request={shell.state.interruption.request}
            onChoose={shell.actions.submitOfferResponse}
            onAbandon={shell.actions.abandonPendingTurn}
          />
        ) : (
          <BattleRequestDialog
            request={shell.state.interruption.request}
            onChoose={shell.actions.submitBattleResult}
            onAbandon={shell.actions.abandonPendingTurn}
          />
        ))}
      {guided.visible && !guided.loading && (
        <GuidedInspectionOverlay
          stepIndex={guided.stepIndex}
          onStepChange={(idx, completed) => {
            if (completed) void guided.dismiss(idx);
            else void guided.advance(idx);
          }}
          onDismiss={(idx) => void guided.dismiss(idx)}
          onNavigate={(screenId) => shell.actions.selectScreen(screenId as Screen)}
        />
      )}
    </WindowContextProvider>
  );
}

export function App({
  bridge = window.bluewave,
}: {
  readonly bridge?: BluewaveDesktopBridge | undefined;
} = {}) {
  return (
    <BridgeProvider bridge={bridge}>
      <PresentationContentGate>
        <CampaignShellProvider bridge={bridge}>
          <CampaignShellApplication bridge={bridge} />
        </CampaignShellProvider>
      </PresentationContentGate>
    </BridgeProvider>
  );
}
