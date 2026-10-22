import { lazy, useCallback } from "react";
import { CampaignPreferencesScreen } from "../screens/campaign-preferences/CampaignPreferencesScreen.js";
import { ConstructionScreen } from "../screens/construction/ConstructionScreen.js";
import { FleetScreen } from "../screens/fleet/FleetScreen.js";
import { OptionsScreen } from "../screens/options/OptionsScreen.js";
import { OverviewScreen } from "../screens/overview/OverviewScreen.js";
import { useCampaignShellContext } from "./CampaignShellContext.js";
import type {
  CampaignScreen,
  CampaignScreenRoute,
  CampaignScreenRouteProps,
} from "./campaign-screen-types.js";

const DebuggingScreen = lazy(() =>
  import("../screens/debugging/DebuggingScreen.js").then((module) => ({
    default: module.DebuggingScreen,
  })),
);
const SimulationScreen = lazy(() =>
  import("../screens/simulation/SimulationScreen.js").then((module) => ({
    default: module.SimulationScreen,
  })),
);
const ResearchScreen = lazy(() =>
  import("../screens/research/ResearchScreen.js").then((module) => ({
    default: module.ResearchScreen,
  })),
);
const DiplomacyScreen = lazy(() =>
  import("../screens/diplomacy/DiplomacyScreen.js").then((module) => ({
    default: module.DiplomacyScreen,
  })),
);
const TreasuryScreen = lazy(() =>
  import("../screens/treasury/TreasuryScreen.js").then((module) => ({
    default: module.TreasuryScreen,
  })),
);
const TacticalSandboxScreen = lazy(() =>
  import("../screens/tactical-sandbox/TacticalSandboxScreen.js").then((module) => ({
    default: module.TacticalSandboxScreen,
  })),
);
const MapPrototypeScreen = lazy(() =>
  import("../screens/map-prototype/MapPrototypeScreen.js").then((module) => ({
    default: module.MapPrototypeScreen,
  })),
);

function OverviewRoute({ sessionId }: CampaignScreenRouteProps) {
  const { actions } = useCampaignShellContext();
  return <OverviewScreen sessionId={sessionId} onNavigate={actions.selectScreen} />;
}

function ConstructionRoute({ sessionId }: CampaignScreenRouteProps) {
  return <ConstructionScreen sessionId={sessionId} />;
}

function FleetRoute({ sessionId }: CampaignScreenRouteProps) {
  return <FleetScreen sessionId={sessionId} />;
}

function SimulationRoute({ sessionId }: CampaignScreenRouteProps) {
  const { state, actions } = useCampaignShellContext();
  const onMonthCommitted = useCallback(
    () => void actions.refreshCampaign(sessionId),
    [actions.refreshCampaign, sessionId],
  );
  return (
    <SimulationScreen
      sessionId={sessionId}
      onPrimaryActionChange={actions.setPrimaryAction}
      campaignRevision={state.campaign?.revision}
      onMonthCommitted={onMonthCommitted}
    />
  );
}

function ResearchRoute({ sessionId }: CampaignScreenRouteProps) {
  return <ResearchScreen sessionId={sessionId} />;
}

function DiplomacyRoute({ sessionId }: CampaignScreenRouteProps) {
  return <DiplomacyScreen sessionId={sessionId} />;
}

function TreasuryRoute({ sessionId }: CampaignScreenRouteProps) {
  return <TreasuryScreen sessionId={sessionId} />;
}

function TacticalSandboxRoute({ sessionId }: CampaignScreenRouteProps) {
  return <TacticalSandboxScreen sessionId={sessionId} />;
}

function DebuggingRoute({ sessionId }: CampaignScreenRouteProps) {
  return <DebuggingScreen sessionId={sessionId} />;
}

function MapPrototypeRoute() {
  return <MapPrototypeScreen />;
}

function CampaignPreferencesRoute({ sessionId }: CampaignScreenRouteProps) {
  const { actions } = useCampaignShellContext();
  return (
    <CampaignPreferencesScreen sessionId={sessionId} onCloseCampaign={actions.closeCampaign} />
  );
}

function OptionsRoute() {
  return <OptionsScreen />;
}

export const CAMPAIGN_SCREEN_ROUTES: Readonly<Record<CampaignScreen, CampaignScreenRoute>> = {
  overview: OverviewRoute,
  construction: ConstructionRoute,
  fleet: FleetRoute,
  simulation: SimulationRoute,
  research: ResearchRoute,
  diplomacy: DiplomacyRoute,
  treasury: TreasuryRoute,
  "tactical-sandbox": TacticalSandboxRoute,
  debugging: DebuggingRoute,
  "map-prototype": MapPrototypeRoute,
  "campaign-preferences": CampaignPreferencesRoute,
  options: OptionsRoute,
};
