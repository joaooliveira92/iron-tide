import { defaultArchetypeSelection } from "@bluewave/campaign-engine";
import { useCallback, useMemo, type ReactNode } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { InspectOpeningBriefingResult } from "../../shared/campaign-contract.js";
import { CampaignFileScreen } from "../screens/campaign-file/CampaignFileScreen.js";
import { translate } from "../lib/strings.js";
import { NewGameArchetypeScreen } from "../screens/new-game/NewGameArchetypeScreen.js";
import { NewGameBriefingScreen } from "../screens/new-game/NewGameBriefingScreen.js";
import { NewGameCommissioningReviewScreen } from "../screens/new-game/NewGameCommissioningReviewScreen.js";
import { NewGameFleetMethodScreen } from "../screens/new-game/NewGameFleetMethodScreen.js";
import { NewGameIdentityScreen } from "../screens/new-game/NewGameIdentityScreen.js";
import { NewGameLaunchingScreen } from "../screens/new-game/NewGameLaunchingScreen.js";
import { NewGameNationScreen } from "../screens/new-game/NewGameNationScreen.js";
import { RulesOfTheNavalAgeScreen } from "../screens/new-game/RulesOfTheNavalAgeScreen.js";
import { defaultFleetMethod } from "../screens/new-game/new-game-fleet-method-screen-state.js";
import { defaultCampaignIdentity } from "../screens/new-game/new-game-identity-screen-state.js";
import { useCampaignShellContext } from "./CampaignShellContext.js";
import type { CampaignShellMode } from "./campaign-shell-state.js";
import type { PrimaryAction } from "./primary-action.js";
import { type NewGameFlow, type NewGameNavigation, useNewGameFlow } from "./useNewGameFlow.js";

type NewGameMode = Exclude<
  CampaignShellMode,
  { kind: "campaign" | "opening" | "open-error" | "file" }
>;

interface NewGameStepContext {
  readonly flow: NewGameFlow;
  readonly onPrimaryActionChange: (action: PrimaryAction | null) => void;
  readonly openCampaign: (sessionId: string) => Promise<void>;
  readonly inspectOpeningBriefing: (
    sessionId: string,
  ) => Promise<BridgeResult<InspectOpeningBriefingResult>>;
}

type NewGameStepRenderer = (ctx: NewGameStepContext) => ReactNode;

const NEW_GAME_STEP_RENDERERS: Record<NewGameMode["kind"], NewGameStepRenderer> = {
  "new-game-nation": ({ flow, onPrimaryActionChange }) => (
    <NewGameNationScreen
      error={flow.state.error}
      onCancel={flow.actions.cancel}
      onConfirm={flow.actions.confirmNation}
      onRecommendedSetup={flow.actions.applyRecommendedSetup}
      onPrimaryActionChange={onPrimaryActionChange}
    />
  ),
  "new-game-preferences": ({ flow, onPrimaryActionChange }) => (
    <RulesOfTheNavalAgeScreen
      onCancel={flow.actions.backToNation}
      onNext={flow.actions.acceptPreferences}
      recommendedPreset={flow.state.draft?.recommendedPreset ?? null}
      onPrimaryActionChange={onPrimaryActionChange}
    />
  ),
  "new-game-archetype": ({ flow, onPrimaryActionChange, openCampaign }) =>
    flow.state.draft === null ? (
      <CampaignFileView onOpenCampaign={openCampaign} onStartNewGame={flow.actions.start} />
    ) : (
      <NewGameArchetypeScreen
        initialArchetype={flow.state.draft.archetype}
        onBack={flow.actions.backToPreferences}
        onNext={flow.actions.acceptArchetype}
        onPrimaryActionChange={onPrimaryActionChange}
      />
    ),
  "new-game-identity": ({ flow, onPrimaryActionChange }) => (
    <NewGameIdentityScreen
      initialIdentity={flow.state.draft?.identity ?? defaultCampaignIdentity()}
      onBack={flow.actions.backToArchetype}
      onNext={flow.actions.acceptIdentity}
      onPrimaryActionChange={onPrimaryActionChange}
    />
  ),
  "new-game-fleet-method": ({ flow, onPrimaryActionChange }) => (
    <NewGameFleetMethodScreen
      initialFleetMethod={flow.state.draft?.fleetMethod ?? defaultFleetMethod()}
      status={flow.state.status}
      error={flow.state.error}
      onBack={flow.actions.backToIdentity}
      onNext={flow.actions.acceptFleetMethod}
      onPrimaryActionChange={onPrimaryActionChange}
    />
  ),
  "new-game-review": ({ flow, onPrimaryActionChange, openCampaign }) =>
    flow.state.draft === null ||
    flow.state.draft.preferences === null ||
    flow.state.draft.identity === null ||
    flow.state.draft.fleetMethod === null ? (
      <CampaignFileView onOpenCampaign={openCampaign} onStartNewGame={flow.actions.start} />
    ) : (
      <NewGameCommissioningReviewScreen
        nationId={flow.state.draft.nationId}
        options={flow.state.draft.options}
        preferences={flow.state.draft.preferences}
        archetype={flow.state.draft.archetype ?? defaultArchetypeSelection()}
        identity={flow.state.draft.identity}
        fleetMethod={flow.state.draft.fleetMethod}
        status={flow.state.status}
        error={flow.state.error}
        onBack={flow.actions.backToFleetMethod}
        onBeginCommission={flow.actions.launch}
        onPrimaryActionChange={onPrimaryActionChange}
      />
    ),
  "new-game-launching": ({ flow }) => (
    <NewGameLaunchingScreen
      error={flow.state.error}
      onBackToReview={flow.actions.backToReviewFromLaunch}
    />
  ),
  "opening-briefing": ({ flow, onPrimaryActionChange, openCampaign, inspectOpeningBriefing }) =>
    flow.state.briefingSessionId === null ? (
      <CampaignFileView onOpenCampaign={openCampaign} onStartNewGame={flow.actions.start} />
    ) : (
      <NewGameBriefingScreen
        sessionId={flow.state.briefingSessionId}
        onInspectOpeningBriefing={inspectOpeningBriefing}
        onTakeCommand={flow.actions.takeCommand}
        onPrimaryActionChange={onPrimaryActionChange}
      />
    ),
};

export function CampaignUnavailableView({
  bridge,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
}) {
  const { state, actions } = useCampaignShellContext();
  const mode = state.mode;

  const navigation = useMemo<NewGameNavigation>(
    () => ({
      openCampaign: actions.openCampaign,
      selectScreen: actions.selectScreen,
    }),
    [actions.openCampaign, actions.selectScreen],
  );
  const flow = useNewGameFlow(bridge, navigation);

  const inspectOpeningBriefing = useCallback(
    async (sessionId: string) => {
      if (bridge === undefined) {
        return {
          outcome: "error" as const,
          reason: "BRIDGE_UNAVAILABLE" as const,
          diagnostics: ["The desktop bridge is unavailable."],
        };
      }
      return bridge.campaign.execute("inspectOpeningBriefing", sessionId);
    },
    [bridge],
  );

  const stepContext = useMemo<NewGameStepContext>(
    () => ({
      flow,
      onPrimaryActionChange: actions.setPrimaryAction,
      openCampaign: actions.openCampaign,
      inspectOpeningBriefing,
    }),
    [flow, actions.setPrimaryAction, actions.openCampaign, inspectOpeningBriefing],
  );

  if (mode.kind === "campaign") return null;

  switch (mode.kind) {
    case "opening":
      return <CampaignLoadingView />;
    case "open-error":
      return (
        <CampaignOpenErrorView
          message={mode.message}
          onOpenCampaign={actions.openCampaign}
          onStartNewGame={flow.actions.start}
        />
      );
    case "file":
      return (
        <CampaignFileView
          onOpenCampaign={actions.openCampaign}
          onStartNewGame={flow.actions.start}
        />
      );
    default:
      return <>{NEW_GAME_STEP_RENDERERS[mode.kind](stepContext)}</>;
  }
}

function CampaignLoadingView() {
  return (
    <div className="p-8">
      <p>{translate("shell.campaign.loading")}</p>
    </div>
  );
}

interface CampaignFileViewProps {
  readonly onOpenCampaign: (sessionId: string) => Promise<void>;
  readonly onStartNewGame: () => void;
}

function CampaignFileView({ onOpenCampaign, onStartNewGame }: CampaignFileViewProps) {
  return <CampaignFileScreen onOpenCampaign={onOpenCampaign} onStartNewGame={onStartNewGame} />;
}

function CampaignOpenErrorView({
  message,
  onOpenCampaign,
  onStartNewGame,
}: CampaignFileViewProps & { readonly message: string }) {
  return (
    <div className="p-8">
      <CampaignFileView onOpenCampaign={onOpenCampaign} onStartNewGame={onStartNewGame} />
      <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <p className="m-0 text-destructive">{message}</p>
      </div>
    </div>
  );
}
