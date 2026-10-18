import { describe, expect, it } from "vite-plus/test";
import {
  buildAreaTree,
  campaignTreeRows,
  resolvePlayerNationId,
  type AreaTreeRow,
} from "./area-tree.js";
import type { CampaignAreaEntry } from "./campaign-map-join.js";

const AREAS: CampaignAreaEntry[] = [
  {
    id: "sea_north_sea",
    name: "North Sea",
    controller: null,
    fleets: [
      { nation: "uk", ships: 4 },
      { nation: "france", ships: 9 },
    ],
  },
  {
    id: "eng_home_coast",
    name: "English Home Waters",
    controller: "uk",
    fleets: [{ nation: "uk", ships: 2 }],
  },
  { id: "med_malta", name: "Malta", controller: "uk", fleets: [] },
  { id: "fra_med_coast", name: "French Mediterranean Coast", controller: "france", fleets: [] },
];
const label = (id: string) => (id === "uk" ? "Britain" : "France");

describe("campaignTreeRows", () => {
  const rows = campaignTreeRows(AREAS, "uk", label, "area_north_sea");
  it("counts only the player's ships and holdings", () => {
    expect(rows.find((r) => r.id === "sea_north_sea")).toMatchObject({
      ships: 4,
      possessed: false,
      selected: true,
    });
    expect(rows.find((r) => r.id === "med_malta")).toMatchObject({
      ships: 0,
      possessed: true,
      owner: "Britain",
    });
    expect(rows.find((r) => r.id === "fra_med_coast")).toMatchObject({ possessed: false });
  });
  it("shows nothing for the player when the nation is unresolved", () => {
    const none = campaignTreeRows(AREAS, null, label, null);
    expect(none.every((r) => r.ships === 0 && !r.possessed)).toBe(true);
  });
});

describe("buildAreaTree", () => {
  const rows = campaignTreeRows(AREAS, "uk", label, null);
  const none = new Set<string>();

  it("Ships lens lists areas with player ships under regions, with count badges", () => {
    const tree = buildAreaTree({ rows, mode: "ships", query: "", toggled: none });
    expect(tree.map((g) => [g.label, g.badge, g.rows.map((r) => r.id)])).toEqual([
      ["Northern Europe", 6, ["eng_home_coast", "sea_north_sea"]],
    ]);
  });

  it("Possessions lens lists player-controlled areas", () => {
    const tree = buildAreaTree({ rows, mode: "possessions", query: "", toggled: none });
    expect(tree.map((g) => [g.label, g.badge])).toEqual([
      ["Northern Europe", 1],
      ["The Mediterranean", 1],
    ]);
  });

  it("filters by name or owner and opens matching groups", () => {
    const tree = buildAreaTree({ rows, mode: "possessions", query: "malta", toggled: none });
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: "mediterranean", expanded: true });
  });

  it("starts collapsed, opens the selected row's group, and honours toggles", () => {
    const base = buildAreaTree({ rows, mode: "possessions", query: "", toggled: none });
    expect(base.every((g) => !g.expanded)).toBe(true);
    const toggled = buildAreaTree({
      rows,
      mode: "possessions",
      query: "",
      toggled: new Set(["mediterranean"]),
    });
    expect(toggled.find((g) => g.id === "mediterranean")?.expanded).toBe(true);
    const selected: AreaTreeRow[] = rows.map((r) =>
      r.id === "med_malta" ? { ...r, selected: true } : r,
    );
    const open = buildAreaTree({ rows: selected, mode: "possessions", query: "", toggled: none });
    expect(open.find((g) => g.id === "mediterranean")?.expanded).toBe(true);
  });

  it("keeps unregioned areas under Other waters instead of dropping them", () => {
    const stray: AreaTreeRow = {
      id: "area_x",
      name: "X",
      owner: null,
      ships: 1,
      possessed: false,
      mapAreaId: null,
      selected: false,
    };
    const tree = buildAreaTree({ rows: [stray], mode: "ships", query: "", toggled: none });
    expect(tree[0]).toMatchObject({ id: "other", label: "Other waters" });
  });
});

describe("resolvePlayerNationId", () => {
  it("matches the projection's nation name against the world's nations", () => {
    const world = {
      nations: [{ id: "uk", name: "Britain", tag: "GBR", homeAreaId: null, presenceAreaIds: [] }],
      areas: [],
      ports: [],
      fleets: [],
    };
    expect(resolvePlayerNationId(world, "Britain")).toBe("uk");
    expect(resolvePlayerNationId(world, "Nowhere")).toBeNull();
  });
});
