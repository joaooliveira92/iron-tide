import type { LocalTab } from "../shipbuilding/design-sections.js";

export const OVERVIEW_TABS: readonly LocalTab[] = [
  { id: "summary", label: "Summary" },
  { id: "dispatches", label: "Battles" },
  { id: "gaps", label: "Not modelled" },
];

export const NATION_TABS: readonly LocalTab[] = [
  { id: "dossier", label: "Dossier" },
  { id: "battles", label: "Battles" },
];

export type DiplomacyPlace =
  | { readonly kind: "overview"; readonly tab: string }
  | { readonly kind: "nation"; readonly nationId: string; readonly tab: string };

export const OVERVIEW_PLACE: DiplomacyPlace = { kind: "overview", tab: "summary" };

export function nationPlace(nationId: string, tab = "dossier"): DiplomacyPlace {
  return { kind: "nation", nationId, tab };
}

export function tabsFor(place: DiplomacyPlace): readonly LocalTab[] {
  return place.kind === "overview" ? OVERVIEW_TABS : NATION_TABS;
}

export function activeTab(place: DiplomacyPlace): LocalTab {
  const tabs = tabsFor(place);
  return tabs.find((tab) => tab.id === place.tab) ?? tabs[0]!;
}

export function reconcilePlace(
  place: DiplomacyPlace,
  nationIds: readonly string[],
): DiplomacyPlace {
  if (place.kind === "nation" && !nationIds.includes(place.nationId)) return OVERVIEW_PLACE;
  return place;
}
