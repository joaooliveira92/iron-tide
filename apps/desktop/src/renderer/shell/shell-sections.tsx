import {
  type ComponentProps,
  createContext,
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { WindowState } from "../../shared/bridge-contract.js";
import {
  MonthlyResolutionFailure,
  MonthlyResolutionLoading,
} from "../components/MonthlyResolutionLoading.js";
import { PreTurnReviewDialog } from "../components/PreTurnReviewDialog.js";
import { useBridge } from "../lib/bridge-context.js";
import {
  CHOOSE_YOUR_ARCHETYPE_HEADING,
  CHOOSE_YOUR_ARCHETYPE_HINT,
} from "../screens/new-game/choose-your-archetype-content.js";
import {
  RULES_OF_THE_NAVAL_AGE_HEADING,
  RULES_OF_THE_NAVAL_AGE_HINT,
} from "../screens/new-game/rules-of-the-naval-age-content.js";
import { AppFrame } from "./AppFrame.js";
import { CampaignUnavailableView } from "./CampaignUnavailableView.js";
import { useCampaignShellActions, useCampaignShellState } from "./CampaignShellContext.js";
import { prioritiesStateFromReads } from "./campaign-reads.js";
import {
  CAMPAIGN_SCREEN_SEARCH_TARGETS,
  CampaignScreenOutlet,
  type Screen,
} from "./campaign-screen-registry.js";
import { type CampaignShellMode, describeMonthCommitFailure } from "./campaign-shell-state.js";
import { GuidedInspectionOverlay } from "./GuidedInspectionOverlay.js";
import { isMapUnderlayScreen } from "./map-underlay-screens.js";
import { SiteHeader } from "./SiteHeader.js";
import {
  type ActiveView,
  type HeaderCampaign,
  type WizardStepCopy,
  headerTitleFor,
} from "./site-header-state.js";
import { useGuidedInspection } from "./useGuidedInspection.js";
import { WindowContextProvider } from "./WindowContext.js";

const EMPTY_SEARCH_TARGETS: readonly {
  readonly id: Screen;
  readonly label: string;
}[] = [];

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

const ReviewOpenContext = createContext(false);
const ReviewControlContext = createContext<Dispatch<SetStateAction<boolean>>>(() => undefined);

export function PreTurnReviewState({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ReviewControlContext.Provider value={setOpen}>
      <ReviewOpenContext.Provider value={open}>{children}</ReviewOpenContext.Provider>
    </ReviewControlContext.Provider>
  );
}

function useHeaderCampaign(): HeaderCampaign | null {
  const { campaign } = useCampaignShellState();
  return useMemo(
    () =>
      campaign === null
        ? null
        : {
            month: campaign.month,
            atWar: campaign.atWar,
            prestige: campaign.prestige,
            ...(campaign.career === undefined ? {} : { career: campaign.career }),
          },
    [campaign],
  );
}

export function ShellWindow({
  bridge,
  initialWindowState,
  children,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly initialWindowState?: WindowState | undefined;
  readonly children: ReactNode;
}) {
  const headerCampaign = useHeaderCampaign();
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
  const value = useMemo(
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

  return <WindowContextProvider value={value}>{children}</WindowContextProvider>;
}

const StableSiteHeader = memo(SiteHeader);
const StableAppFrame = memo(AppFrame);
const StableResolutionLoading = memo(MonthlyResolutionLoading);

function ActiveCampaignView({ screen }: { readonly screen: Screen }) {
  return (
    <div className={isMapUnderlayScreen(screen) ? "h-full font-sans" : "p-4 font-sans"}>
      <CampaignScreenOutlet screen={screen} />
    </div>
  );
}

function ShellHeader() {
  const state = useCampaignShellState();
  const actions = useCampaignShellActions();
  const setReviewOpen = use(ReviewControlContext);
  const headerCampaign = useHeaderCampaign();
  const { campaign, reads, mode, canGoBack, canGoForward, primaryAction, saving } = state;
  const { selectScreen, goBack, goForward, saveCampaign, copyCampaign, closeCampaign } = actions;

  const briefing = useMemo(
    () =>
      campaign === null || reads === null
        ? undefined
        : { state: prioritiesStateFromReads(reads), onNavigate: selectScreen },
    [campaign, reads, selectScreen],
  );
  const back = useMemo(() => ({ disabled: !canGoBack, onTrigger: goBack }), [canGoBack, goBack]);
  const forward = useMemo(
    () => ({ disabled: !canGoForward, onTrigger: goForward }),
    [canGoForward, goForward],
  );
  const campaignMenu = useMemo(
    () => ({ saving, onSave: saveCampaign, onCopy: copyCampaign, onCloseCampaign: closeCampaign }),
    [saving, saveCampaign, copyCampaign, closeCampaign],
  );
  const onSearchNavigate = useCallback((id: string) => selectScreen(id as Screen), [selectScreen]);
  const hasCampaign = campaign !== null;
  const onAdvanceMonth = useMemo(
    () => (hasCampaign ? () => setReviewOpen(true) : undefined),
    [hasCampaign, setReviewOpen],
  );
  const headerProps: ComponentProps<typeof SiteHeader> = {
    title: headerTitleFor(headerCampaign),
    activeView: activeViewFor(mode),
    campaign: headerCampaign,
    wizardStep: WIZARD_STEP_COPY[mode.kind],
    back,
    forward,
    searchTargets: hasCampaign ? CAMPAIGN_SCREEN_SEARCH_TARGETS : EMPTY_SEARCH_TARGETS,
    onSearchNavigate,
    onAdvanceMonth,
    advancingMonth: state.committing,
    advanceDisabled: state.interruption !== null,
    campaignMenu,
    ...(briefing === undefined ? {} : { briefing }),
    ...(primaryAction !== null ? { continueAction: primaryAction } : {}),
  };
  return <StableSiteHeader {...headerProps} />;
}

function ShellContent() {
  const { mode, screen } = useCampaignShellState();
  const bridge = useBridge();
  return mode.kind !== "campaign" ? (
    <CampaignUnavailableView bridge={bridge} />
  ) : (
    <ActiveCampaignView screen={screen} />
  );
}

const HEADER = <ShellHeader />;
const CONTENT = <ShellContent />;

export function ShellFrame() {
  const { campaign, reads, screen, saveMessage } = useCampaignShellState();
  const { selectScreen } = useCampaignShellActions();
  return (
    <StableAppFrame
      campaignSessionId={campaign?.sessionId ?? null}
      campaignReads={reads}
      screen={screen}
      saveMessage={saveMessage}
      header={HEADER}
      onSelectScreen={selectScreen}
    >
      {CONTENT}
    </StableAppFrame>
  );
}

export function ShellResolution() {
  const { committing, commitFailure } = useCampaignShellState();
  const { selectScreen, advanceMonth } = useCampaignShellActions();
  const onReturn = useCallback(() => selectScreen("overview"), [selectScreen]);
  const onRetry = useCallback(async () => {
    await advanceMonth();
  }, [advanceMonth]);
  return (
    <>
      <StableResolutionLoading committing={committing} />
      {commitFailure !== null && (
        <MonthlyResolutionFailure
          message={describeMonthCommitFailure(commitFailure)}
          onReturn={onReturn}
          onRetry={onRetry}
        />
      )}
    </>
  );
}

export function ShellPreTurnReview() {
  const { campaign, saving, saveMessage, committing } = useCampaignShellState();
  const { selectScreen, advanceMonth } = useCampaignShellActions();
  const open = use(ReviewOpenContext);
  const setOpen = use(ReviewControlContext);
  if (campaign === null) return null;
  return (
    <PreTurnReviewDialog
      open={open}
      onOpenChange={setOpen}
      sessionId={campaign.sessionId}
      campaign={campaign}
      saving={saving}
      saveMessage={saveMessage}
      committing={committing}
      onOpenPriority={(priority) => {
        setOpen(false);
        selectScreen(priority.destination);
      }}
      onAdvance={async () => {
        setOpen(false);
        await advanceMonth();
      }}
    />
  );
}

export function ShellGuidedInspection() {
  const { mode } = useCampaignShellState();
  const { selectScreen } = useCampaignShellActions();
  const guided = useGuidedInspection({
    sessionId: mode.kind === "campaign" ? mode.campaign.sessionId : null,
  });
  if (!guided.visible || guided.loading) return null;
  return (
    <GuidedInspectionOverlay
      stepIndex={guided.stepIndex}
      onStepChange={(idx, completed) => {
        if (completed) void guided.dismiss(idx);
        else void guided.advance(idx);
      }}
      onDismiss={(idx) => void guided.dismiss(idx)}
      onNavigate={(screenId) => selectScreen(screenId as Screen)}
    />
  );
}
