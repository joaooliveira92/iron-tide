export const STRATEGIC_DESTINATION_SECTIONS = [
  "overview",
  "construction",
  "fleet",
  "research",
  "diplomacy",
] as const;

export type StrategicDestinationSection = (typeof STRATEGIC_DESTINATION_SECTIONS)[number];

export type StrategicDestination =
  | { readonly section: "overview" }
  | { readonly section: "research"; readonly focusTechnologyId?: string }
  | { readonly section: "construction"; readonly focusProjectId?: string }
  | { readonly section: "fleet"; readonly focusShipId?: string }
  | { readonly section: "diplomacy"; readonly focusNationId?: string };
