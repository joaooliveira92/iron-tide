import { describe, expect, it } from "vite-plus/test";
import {
  NATION_TABS,
  OVERVIEW_PLACE,
  OVERVIEW_TABS,
  activeTab,
  nationPlace,
  reconcilePlace,
  tabsFor,
} from "./diplomacy-sections.js";

describe("diplomacy places", () => {
  it("offers overview tabs on the overview and dossier tabs on a nation", () => {
    expect(tabsFor(OVERVIEW_PLACE)).toBe(OVERVIEW_TABS);
    expect(tabsFor(nationPlace("france"))).toBe(NATION_TABS);
  });

  it("falls back to the first tab when the remembered tab does not exist", () => {
    expect(activeTab({ kind: "overview", tab: "nope" }).id).toBe("summary");
    expect(activeTab(nationPlace("france", "battles")).id).toBe("battles");
  });

  it("returns to the overview when the selected nation leaves the roster", () => {
    const place = nationPlace("france");
    expect(reconcilePlace(place, ["france", "spain"])).toBe(place);
    expect(reconcilePlace(place, ["spain"])).toBe(OVERVIEW_PLACE);
    expect(reconcilePlace(OVERVIEW_PLACE, [])).toBe(OVERVIEW_PLACE);
  });
});
