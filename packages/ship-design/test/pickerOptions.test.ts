import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CompiledPartModelSchema, decodeStrict } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  buildPartCatalogueView,
  pickerOptions,
  type PartCatalogueEntry,
  type PickerQuery,
} from "../src/index.js";

const artifact: unknown = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "..", "content", "generated", "1880", "content-artifact.json"),
    "utf8",
  ),
);
const shipBuilding = (artifact as { readonly shipBuilding: Readonly<Record<string, unknown>> })
  .shipBuilding;
const model = decodeStrict(CompiledPartModelSchema, shipBuilding["partModel"]);
const catalogue = buildPartCatalogueView(model);
const byId = new Map(catalogue.map((e) => [e.id, e]));
const entry = (id: string): PartCatalogueEntry => {
  const found = byId.get(id);
  if (found === undefined) throw new Error(`missing catalogue entry ${id}`);
  return found;
};

const entryOf = (over: Partial<PartCatalogueEntry>): PartCatalogueEntry => ({
  id: "x",
  displayName: "X",
  category: "MAIN_GUN",
  introduction: { fromMonth: "1880-01", obsoleteMonth: null },
  requires: [],
  tags: [],
  fcClass: null,
  parameters: {},
  entryUnits: null,
  rounds: null,
  ...over,
});

const base: PickerQuery = { month: "1880-01", unlockedTechs: new Set(["gun_breech_rifled"]) };

describe("catalogue entry nation, calibre and role (#575)", () => {
  it("derives nationIds for a family from its national variants, sorted", () => {
    expect(entry("gun_bl_10in_32").nationIds).toEqual(["uk"]);
    expect(entry("gun_bl_12in_25").nationIds).toEqual(["france", "russia", "uk"]);
    expect(entry("gun_bl_274mm_m1875").nationIds).toEqual(["france"]);
  });

  it("leaves nationIds absent where the part model carries no national variant", () => {
    expect(entry("gun_rml_12in_25ton").nationIds).toBeUndefined();
  });

  it("derives torpedo tube nationIds from the national tubes that extend each family, sorted (#618)", () => {
    expect(entry("tube_14in_above_water").nationIds).toEqual([
      "austria_hungary",
      "brazil",
      "france",
      "germany",
      "italy",
      "japan",
      "netherlands",
      "ottoman_empire",
      "portugal",
      "qing",
      "russia",
      "spain",
      "uk",
      "usa",
    ]);
    expect(entry("tube_14in_submerged").nationIds).toEqual(["france", "germany", "uk"]);
  });

  it("leaves torpedo nationIds absent where no national tube extends the family (#618)", () => {
    expect(entry("tube_21in_above_water").nationIds).toBeUndefined();
  });

  it("filters a torpedo family by nation through the shared picker (#618)", () => {
    const tube = entry("tube_14in_submerged");
    const { available, hidden } = pickerOptions(catalogue, {
      month: "1880-01",
      unlockedTechs: new Set(tube.requires),
      nationId: "japan",
      category: "TORPEDO_TUBE",
    });
    expect(available.map((e) => e.id)).not.toContain("tube_14in_submerged");
    const reasons = new Map(hidden.map((h) => [h.entry.id, h.reason]));
    expect(reasons.get("tube_14in_submerged")).toBe("other_nation");
  });

  it("carries the gun calibre in micrometres and role tags without the generic gun tag", () => {
    expect(entry("gun_bl_10in_32").caliberUm).toBe(254000);
    expect(entry("gun_bl_10in_32").roleTags).toEqual(["heavy"]);
    expect(entry("gun_bl_6in_26").roleTags).toEqual(["medium"]);
    expect(entry("tube_14in_above_water").caliberUm).toBeUndefined();
  });
});

describe("pickerOptions (#575)", () => {
  it("hides later-era and other-nation guns by default for a British 1880 draft", () => {
    const { available, hidden } = pickerOptions(catalogue, {
      ...base,
      nationId: "uk",
      category: "MAIN_GUN",
    });
    const ids = available.map((e) => e.id);
    expect(ids).toContain("gun_rml_12in_25ton");
    expect(ids).toContain("gun_rml_10in_18ton");
    expect(ids).not.toContain("gun_bl_12in_35");
    expect(ids).not.toContain("gun_bl_274mm_m1875");
    expect(available.every((e) => e.introduction.fromMonth <= "1880-01")).toBe(true);
    const reasons = new Map(hidden.map((h) => [h.entry.id, h.reason]));
    expect(reasons.get("gun_bl_12in_35")).toBe("not_yet_available");
    expect(reasons.get("gun_bl_274mm_m1875")).toBe("other_nation");
  });

  it("shows other nations' parts when all nations are requested", () => {
    const { available } = pickerOptions(catalogue, {
      ...base,
      nationId: "uk",
      showAllNations: true,
      category: "MAIN_GUN",
    });
    expect(available.map((e) => e.id)).toContain("gun_bl_274mm_m1875");
  });

  it("excludes obsolete parts and parts with unmet tech, giving the reason", () => {
    const entries = [
      entryOf({ id: "old", introduction: { fromMonth: "1860-01", obsoleteMonth: "1880-01" } }),
      entryOf({ id: "locked", requires: ["tech_a"] }),
      entryOf({ id: "ok", requires: ["tech_b"] }),
    ];
    const { available, hidden } = pickerOptions(entries, {
      month: "1880-01",
      unlockedTechs: new Set(["tech_b"]),
    });
    expect(available.map((e) => e.id)).toEqual(["ok"]);
    expect(hidden).toEqual([
      { entry: entries[0], reason: "obsolete" },
      { entry: entries[1], reason: "missing_tech" },
    ]);
  });

  it("treats entries without nation data as available to every nation", () => {
    const entries = [entryOf({ id: "neutral" }), entryOf({ id: "fr", nationIds: ["france"] })];
    const { available } = pickerOptions(entries, { ...base, nationId: "uk" });
    expect(available.map((e) => e.id)).toEqual(["neutral"]);
  });

  it("narrows by calibre range and role", () => {
    const entries = [
      entryOf({ id: "small", caliberUm: 152000, roleTags: ["medium"] }),
      entryOf({ id: "big", caliberUm: 305000, roleTags: ["heavy"] }),
      entryOf({ id: "none" }),
    ];
    const calibre = pickerOptions(entries, { ...base, caliberRange: { minUm: 200000 } });
    expect(calibre.available.map((e) => e.id)).toEqual(["big"]);
    expect(calibre.hidden.map((h) => [h.entry.id, h.reason])).toEqual([
      ["small", "calibre"],
      ["none", "calibre"],
    ]);
    const role = pickerOptions(entries, { ...base, role: "medium" });
    expect(role.available.map((e) => e.id)).toEqual(["small"]);
    expect(role.hidden.every((h) => h.reason === "role")).toBe(true);
  });

  it("is a pure function of its inputs", () => {
    const query: PickerQuery = { ...base, nationId: "uk", category: "MAIN_GUN" };
    expect(pickerOptions(catalogue, query)).toEqual(pickerOptions([...catalogue], { ...query }));
  });
});
