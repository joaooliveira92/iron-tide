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
import { translate } from "../lib/strings.js";
import { useCampaignShellContext } from "./CampaignShellContext.js";
import { CAMPAIGN_SCREEN_ROUTES } from "./campaign-screen-routes.js";
import type { CampaignScreen, CampaignScreenDefinition, Screen } from "./campaign-screen-types.js";
import { DEBUG_MODE } from "./debug-flag.js";

export type { CampaignScreen, Screen } from "./campaign-screen-types.js";

// PROTOTYPE — throwaway, ticket 06. Never registered in a production build, so
// a stray merge cannot ship a fixture world to players.
const MAP_PROTOTYPE_SCREEN: CampaignScreenDefinition = {
  id: "map-prototype",
  label: translate("nav.screen.map-prototype.label"),
  shortLabel: translate("nav.screen.map-prototype.short"),
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
  label: translate("nav.screen.simulation.label"),
  shortLabel: translate("nav.screen.simulation.short"),
  icon: Activity,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES.simulation,
};
const TACTICAL_SANDBOX_SCREEN: CampaignScreenDefinition = {
  id: "tactical-sandbox",
  label: translate("nav.screen.tactical-sandbox.label"),
  shortLabel: translate("nav.screen.tactical-sandbox.short"),
  icon: Crosshair,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES["tactical-sandbox"],
};
const DEBUGGING_SCREEN: CampaignScreenDefinition = {
  id: "debugging",
  label: translate("nav.screen.debugging.label"),
  shortLabel: translate("nav.screen.debugging.short"),
  icon: Terminal,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES.debugging,
};

// Sixth campaign section (spec §5) — always registered, like the five real
// screens.
const TREASURY_SCREEN: CampaignScreenDefinition = {
  id: "treasury",
  label: translate("nav.screen.treasury.label"),
  shortLabel: translate("nav.screen.treasury.short"),
  icon: Coins,
  group: "campaign",
  searchable: true,
  route: CAMPAIGN_SCREEN_ROUTES.treasury,
};

export const CAMPAIGN_SCREEN_REGISTRY: readonly CampaignScreenDefinition[] = [
  {
    id: "overview",
    label: translate("nav.screen.overview.label"),
    shortLabel: translate("nav.screen.overview.short"),
    icon: LayoutDashboard,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.overview,
  },
  {
    id: "construction",
    label: translate("nav.screen.construction.label"),
    shortLabel: translate("nav.screen.construction.short"),
    icon: Hammer,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.construction,
  },
  {
    id: "fleet",
    label: translate("nav.screen.fleet.label"),
    shortLabel: translate("nav.screen.fleet.short"),
    icon: Ship,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.fleet,
  },
  ...(DEBUG_MODE ? [SIMULATION_SCREEN] : []),
  {
    id: "research",
    label: translate("nav.screen.research.label"),
    shortLabel: translate("nav.screen.research.short"),
    icon: FlaskConical,
    group: "campaign",
    searchable: true,
    route: CAMPAIGN_SCREEN_ROUTES.research,
  },
  {
    id: "diplomacy",
    label: translate("nav.screen.diplomacy.label"),
    shortLabel: translate("nav.screen.diplomacy.short"),
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
    label: translate("nav.screen.campaign-preferences.label"),
    shortLabel: translate("nav.screen.campaign-preferences.short"),
    icon: Settings2,
    group: "settings",
    searchable: false,
    route: CAMPAIGN_SCREEN_ROUTES["campaign-preferences"],
  },
  {
    id: "options",
    label: translate("nav.screen.options.label"),
    shortLabel: translate("nav.screen.options.short"),
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
