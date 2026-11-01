import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
import { isMapUnderlayScreen } from "./map-underlay-screens.js";
import { type CampaignShellMode, describeMonthCommitFailure } from "./campaign-shell-state.js";
import { AppFrame } from "./AppFrame.js";
import { BackgroundLayer } from "./BackgroundLayer.js";
import { useBackground } from "./BackgroundContext.js";
import { prioritiesStateFromReads } from "./campaign-reads.js";
import { CampaignUnavailableView } from "./CampaignUnavailableView.js";
import { CampaignShellProvider, useCampaignShellContext } from "./CampaignShellContext.js";
import { GuidedInspectionOverlay } from "./GuidedInspectionOverlay.js";
import { UiCatalogueGate } from "../content/UiCatalogueGate.js";
import { OfferDialog } from "./interruptions/OfferDialog.js";
import { DecisionDialog } from "./interruptions/DecisionDialog.js";
import { PendingTurnRecoveryPrompt } from "./interruptions/PendingTurnRecoveryPrompt.js";
import { MapSheet } from "./MapSheet.js";
import { ScreenHeaderProvider } from "./screen-header.js";
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

const PlayerBattleScreen = lazy(() =>
  import("../screens/battle/PlayerBattleScreen.js").then((module) => ({
    default: module.PlayerBattleScreen,
  })),
);

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
    <div className={isMapUnderlayScreen(screen) ? "h-full font-sans" : "p-4 font-sans"}>
      <CampaignScreenOutlet screen={screen} />
    </div>
  );
}

function CampaignShellApplication({
  bridge,
  initialWindowState,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly initialWindowState?: WindowState | undefined;
}) {
  const { resolvedTheme } = useTheme();
  const { background } = useBackground();
  const shell = useCampaignShellContext();
  const [windowState, setWindowState] = useState<WindowState | null>(initialWindowState ?? null);

  useEffect(() => {
    if (initialWindowState !== undefined) {
      setWindowState(initialWindowState);
      return;
    }
    let active = true;
    async function loadWindowState(): Promise<void> {
      if (bridge === undefined) return;
      try {
        const state = await bridge.getWindowState();
        if (active) setWindowState(state);
      } catch {}
    }
    void loadWindowState();
    return () => {
      active = false;
    };
  }, [bridge, initialWindowState]);

  const platform = bridge?.platform ?? "darwin";
  const headerCampaign: HeaderCampaign | null = useMemo(
    () =>
      shell.state.campaign === null
        ? null
        : {
            month: shell.state.campaign.month,
            atWar: shell.state.campaign.atWar,
            prestige: shell.state.campaign.prestige,
            ...(shell.state.campaign.career === undefined
              ? {}
              : { career: shell.state.campaign.career }),
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

  const briefing = useMemo(
    () =>
      shell.state.campaign === null || shell.state.reads === null
        ? undefined
        : {
            state: prioritiesStateFromReads(shell.state.reads),
            onNavigate: shell.actions.selectScreen,
          },
    [shell.state.campaign, shell.state.reads, shell.actions.selectScreen],
  );

  const header = (
    <SiteHeader
      title={headerTitleFor(headerCampaign)}
      activeView={activeView}
      campaign={headerCampaign}
      {...(briefing === undefined ? {} : { briefing })}
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
      <ScreenHeaderProvider>
        <BackgroundLayer background={background} resolvedTheme={resolvedTheme} />
        <AppFrame
          campaignSessionId={shell.state.campaign?.sessionId ?? null}
          campaignReads={shell.state.reads}
          screen={shell.state.screen}
          saveMessage={shell.state.saveMessage}
          header={header}
          onSelectScreen={shell.actions.selectScreen}
        >
          {content}
        </AppFrame>
        <MapSheet />
        <MonthlyResolutionLoading committing={shell.state.committing} />
        {shell.state.commitFailure !== null && (
          <MonthlyResolutionFailure
            message={describeMonthCommitFailure(shell.state.commitFailure)}
            onReturn={() => shell.actions.selectScreen("overview")}
            onRetry={async () => {
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
            onOpenPriority={(priority) => {
              setReviewOpen(false);
              shell.actions.selectScreen(priority.destination);
            }}
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
              onAnswer={(optionId) =>
                void shell.actions.answerInterruption({ kind: "decision", optionId })
              }
              onAbandon={shell.actions.abandonPendingTurn}
            />
          ) : shell.state.interruption.request.kind === "offer" ? (
            <OfferDialog
              request={shell.state.interruption.request}
              onChoose={(choice) =>
                void shell.actions.answerInterruption({ kind: "offer", choice })
              }
              onAbandon={shell.actions.abandonPendingTurn}
            />
          ) : (
            <Suspense fallback={<MonthlyResolutionLoading committing />}>
              <PlayerBattleScreen
                request={shell.state.interruption.request}
                sessionId={shell.state.campaign.sessionId}
                onSubmitResult={(outcome) =>
                  void shell.actions.answerInterruption({ kind: "battle-outcome", outcome })
                }
                onAbandon={shell.actions.abandonPendingTurn}
              />
            </Suspense>
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
      </ScreenHeaderProvider>
    </WindowContextProvider>
  );
}

export function App({
  bridge = window.bluewave,
  initialWindowState,
}: {
  readonly bridge?: BluewaveDesktopBridge | undefined;
  readonly initialWindowState?: WindowState | undefined;
} = {}) {
  return (
    <BridgeProvider bridge={bridge}>
      <PresentationContentGate>
        <UiCatalogueGate>
          <CampaignShellProvider bridge={bridge}>
            <CampaignShellApplication bridge={bridge} initialWindowState={initialWindowState} />
          </CampaignShellProvider>
        </UiCatalogueGate>
      </PresentationContentGate>
    </BridgeProvider>
  );
}
