import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type Screen =
  | "file"
  | "new-game-nation"
  | "new-game-preferences"
  | "new-game-archetype"
  | "new-game-identity"
  | "new-game-fleet-method"
  | "new-game-review"
  | "new-game-launching"
  | "opening-briefing"
  | CampaignScreen;

export type CampaignScreen =
  | "overview"
  | "construction"
  | "fleet"
  | "simulation"
  | "research"
  | "diplomacy"
  | "treasury"
  | "tactical-sandbox"
  | "debugging"
  | "strategic-map"
  | "campaign-preferences"
  | "options";

export interface CampaignScreenRouteProps {
  readonly sessionId: string;
}

export type CampaignScreenRoute = ComponentType<CampaignScreenRouteProps>;

export interface CampaignScreenDefinition {
  readonly id: CampaignScreen;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: LucideIcon;
  readonly group: "campaign" | "settings";
  readonly searchable: boolean;
  readonly route: CampaignScreenRoute;
}
