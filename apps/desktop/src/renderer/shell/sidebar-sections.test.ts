import { describe, expect, it } from "vite-plus/test";
import type { CampaignScreen } from "./campaign-screen-registry.js";
import {
  SECTION_OF_SCREEN,
  SIDEBAR_SECTION_ORDER,
  buildSidebarSections,
} from "./sidebar-sections.js";

const items = (...ids: CampaignScreen[]) => ids.map((id) => ({ id }));

describe("buildSidebarSections", () => {
  it("groups the player's screens by the job they do, in a fixed order", () => {
    const sections = buildSidebarSections(
      items("overview", "construction", "fleet", "research", "diplomacy", "treasury"),
    );
    expect(sections.map((s) => [s.label, s.items.map((i) => i.id)])).toEqual([
      ["Admiralty", ["overview"]],
      ["Operations", ["construction", "fleet"]],
      ["Government", ["research", "treasury"]],
      ["Foreign", ["diplomacy"]],
    ]);
  });

  it("keeps registry order inside a section, whatever order the sections were registered in", () => {
    const sections = buildSidebarSections(items("fleet", "construction", "overview"));
    expect(sections.map((s) => s.id)).toEqual(["admiralty", "operations"]);
    expect(sections[1]?.items.map((i) => i.id)).toEqual(["fleet", "construction"]);
  });

  it("omits sections with nothing registered (no empty Developer heading in a release build)", () => {
    const sections = buildSidebarSections(items("overview", "options"));
    expect(sections.map((s) => s.id)).toEqual(["admiralty", "settings"]);
  });

  it("puts developer tooling after the player's sections and settings last", () => {
    const sections = buildSidebarSections(
      items("options", "debugging", "overview", "tactical-sandbox", "campaign-preferences"),
    );
    expect(sections.map((s) => s.id)).toEqual(["admiralty", "developer", "settings"]);
  });

  it("never loses a screen: every screen lands in exactly one section", () => {
    const all = Object.keys(SECTION_OF_SCREEN) as CampaignScreen[];
    const placed = buildSidebarSections(items(...all)).flatMap((s) => s.items.map((i) => i.id));
    expect([...placed].sort()).toEqual([...all].sort());
  });

  it("only uses sections that have a place in the fixed order", () => {
    for (const section of Object.values(SECTION_OF_SCREEN)) {
      expect(SIDEBAR_SECTION_ORDER).toContain(section);
    }
  });
});
