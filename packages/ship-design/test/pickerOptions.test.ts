import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CompiledPartModelSchema,
  FlattenedPartSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  buildPartCatalogueView,
  pickerOptions,
  type NationAccessSource,
  type PartCatalogueEntry,
  type PickerQuery,
} from "../src/index.js";
import { navalProfiles } from "./helpers/earlyContext.js";

const artifact: unknown = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "..", "content", "generated", "1880", "content-artifact.json"),
    "utf8",
  ),
);
const shipBuilding = (artifact as { readonly shipBuilding: Readonly<Record<string, unknown>> })
  .shipBuilding;
const model = decodeStrict(CompiledPartModelSchema, shipBuilding["partModel"]);
const catalogue = buildPartCatalogueView(model, navalProfiles);
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

  it("derives nationIds from profile component access for a family with no national variant (#618)", () => {
    expect(entry("gun_rml_12in_25ton").nationIds).toEqual(["france", "germany", "russia", "uk"]);
    expect(entry("gun_rml_12in_35ton").nationIds).toEqual(["france", "germany", "uk"]);
    expect(entry("gun_rml_16in_80ton").nationIds).toEqual(["france", "germany", "uk", "usa"]);
  });

  it("excludes only nations whose profile marks a quick-firing family unavailable (#618)", () => {
    for (const id of ["gun_qf_6pdr", "gun_hotchkiss_3pdr", "gun_maxim_303"]) {
      const nations = entry(id).nationIds ?? [];
      expect(nations, id).toContain("brazil");
      expect(nations, id).not.toContain("usa");
    }
  });

  it("keeps variant-derived nations for a family that has national variants (#618)", () => {
    expect(entry("gun_bl_10in_32").nationIds).toEqual(["uk"]);
  });

  it("hides a family-level gun from a nation whose profile marks it unavailable (#618)", () => {
    const { available, hidden } = pickerOptions(catalogue, {
      month: "1880-01",
      unlockedTechs: new Set(entry("gun_rml_16in_80ton").requires),
      nationId: "japan",
      category: "MAIN_GUN",
    });
    expect(available.map((e) => e.id)).not.toContain("gun_rml_16in_80ton");
    expect(hidden.find((h) => h.entry.id === "gun_rml_16in_80ton")?.reason).toBe("other_nation");
  });

  it("derives anti-aircraft nationIds from profile component access (#618)", () => {
    const radar = Object.values(model.partIndex.byId).find((part) => part.family === "radar");
    if (radar === undefined) throw new Error("no radar part to adapt");
    const aaId = "aa_probe_gun";
    const aaModel = {
      ...model,
      partIndex: {
        ...model.partIndex,
        byId: {
          ...model.partIndex.byId,
          [aaId]: decodeStrict(FlattenedPartSchema, {
            ...radar,
            id: aaId,
            family: "aa_weapon",
            provides: "aa_weapon",
            spec: {},
          }),
        },
      },
    };
    const profiles: readonly NationAccessSource[] = [
      { nationId: "uk", componentAccess: {} },
      { nationId: "japan", componentAccess: { [aaId]: { status: "UNAVAILABLE" } } },
    ];
    const probe = buildPartCatalogueView(aaModel, profiles).find((e) => e.id === aaId);
    expect(probe?.category).toBe("AA_WEAPON");
    expect(probe?.nationIds).toEqual(["uk"]);
  });

  it("filters an anti-aircraft entry by nation through the shared picker (#618)", () => {
    const aa = entryOf({ id: "aa_x", category: "AA_WEAPON", nationIds: ["uk"] });
    const query = { ...base, category: "AA_WEAPON" as const };
    expect(pickerOptions([aa], { ...query, nationId: "uk" }).available).toEqual([aa]);
    expect(pickerOptions([aa], { ...query, nationId: "france" }).hidden).toEqual([
      { entry: aa, reason: "other_nation" },
    ]);
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
