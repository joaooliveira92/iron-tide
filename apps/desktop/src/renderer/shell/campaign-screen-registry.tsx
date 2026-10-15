import {
  Activity,
  Coins,
  Crosshair,
  FlaskConical,
  Hammer,
  Handshake,
  LayoutDashboard,
  Map as MapIcon,
  Settings,
  Settings2,
  Ship,
  Terminal,
} from "lucide-react";
import { Suspense } from "react";
import { useCampaignShellContext } from "./CampaignShellContext.js";
import { CAMPAIGN_SCREEN_ROUTES } from "./campaign-screen-routes.js";
import type { CampaignScreen, CampaignScreenDefinition, Screen } from "./campaign-screen-types.js";
import { DEBUG_MODE } from "./debug-flag.js";

export type { CampaignScreen, Screen } from "./campaign-screen-types.js";

// PROTOTYPE — throwaway, ticket 06. Never registered in a production build, so
// a stray merge cannot ship a fixture world to players.
const MAP_PROTOTYPE_SCREEN: CampaignScreenDefinition = {
  id: "map-prototype",
  label: "Map Prototype",
  shortLabel: "Map",
  icon: MapIcon,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES["map-prototype"],
};

// Debug-only screens below are gated by DEBUG_MODE (shell/debug-flag.ts, ADR-0029):
// a plain `pnpm dev` does not enable them, so they (and their lazy chunks) stay
// out of the sidebar unless debug mode is explicitly requested (`pnpm dev:debug`).

const SIMULATION_SCREEN: CampaignScreenDefinition = {
  id: "simulation",
  label: "Simulation & Turn",
  shortLabel: "Sim",
  icon: Activity,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES.simulation,
};
const TACTICAL_SANDBOX_SCREEN: CampaignScreenDefinition = {
  id: "tactical-sandbox",
  label: "Tactical Sandbox",
  shortLabel: "Sandbox",
  icon: Crosshair,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES["tactical-sandbox"],
};
const DEBUGGING_SCREEN: CampaignScreenDefinition = {
  id: "debugging",
  label: "Debugging & Telemetry",
  shortLabel: "Debug",
  icon: Terminal,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES.debugging,
};

// Sixth campaign section (spec §5) — always registered, like the five real
// screens.
const TREASURY_SCREEN: CampaignScreenDefinition = {
  id: "treasury",
  label: "Treasury",
  shortLabel: "Treasury",
  icon: Coins,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES.treasury,
};

export const CAMPAIGN_SCREEN_REGISTRY: readonly CampaignScreenDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Overview",
    icon: LayoutDashboard,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.overview,
  },
  {
    id: "construction",
    label: "Construction",
    shortLabel: "Build",
    icon: Hammer,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.construction,
  },
  {
    id: "fleet",
    label: "Fleet",
    shortLabel: "Fleet",
    icon: Ship,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.fleet,
  },
  ...(DEBUG_MODE ? [SIMULATION_SCREEN] : []),
  {
    id: "research",
    label: "Research & Technology",
    shortLabel: "Research",
    icon: FlaskConical,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.research,
  },
  {
    id: "diplomacy",
    label: "Diplomacy & War",
    shortLabel: "Diplomacy",
    icon: Handshake,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.diplomacy,
  },
  TREASURY_SCREEN,
  ...(DEBUG_MODE ? [TACTICAL_SANDBOX_SCREEN, DEBUGGING_SCREEN] : []),
  ...(import.meta.env.DEV ? [MAP_PROTOTYPE_SCREEN] : []),
  {
    id: "campaign-preferences",
    label: "Campaign Preferences",
    shortLabel: "Prefs",
    icon: Settings2,
    group: "settings",
    searchable: false,
    route: CAMPAIGN_SCREEN_ROUTES["campaign-preferences"],
  },
  {
    id: "options",
    label: "Options",
    shortLabel: "Options",
    icon: Settings,
    group: "settings",
    searchable: false,
    route: CAMPAIGN_SCREEN_ROUTES.options,
  },
];

export const CAMPAIGN_SCREENS = CAMPAIGN_SCREEN_REGISTRY.filter(
  (screen) => screen.group === "campaign",
);
export const SETTINGS_SCREENS = CAMPAIGN_SCREEN_REGISTRY.filter(
  (screen) => screen.group === "settings",
);
export const CAMPAIGN_SCREEN_SEARCH_TARGETS = CAMPAIGN_SCREEN_REGISTRY.filter(
  (screen) => screen.searchable,
).map(({ id, label }) => ({ id, label }));

const ROUTE_COMPONENTS = new Map(CAMPAIGN_SCREEN_REGISTRY.map(({ id, route }) => [id, route]));

export interface CampaignScreenOutletProps {
  readonly screen: Screen;
}

export function CampaignScreenOutlet({ screen }: CampaignScreenOutletProps) {
  const { state } = useCampaignShellContext();
  if (state.mode.kind !== "campaign") return null;
  const Route = ROUTE_COMPONENTS.get(screen as CampaignScreen);
  if (Route === undefined) return null;
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading screen…</div>}>
      <Route sessionId={state.mode.campaign.sessionId} />
    </Suspense>
  );
}
