import { describe, it, expect } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  ShipComponentCatalogueSchema,
  PropulsionPlantCatalogueSchema,
  ShipHullFormCatalogueSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import { lintCatalogue } from "../src/component.js";
import { hullFormsFromRecords, ContentError } from "../src/contextBuilder.js";
import {
  shipBalanceFromRecord,
  bp,
  kg,
  mm,
  type ComponentDef,
  type HullFormRecord,
  type PropulsionPlant,
} from "../src/index.js";
import { hullStructureWeight } from "../src/hull.js";
import { requiredKw, type MachineryInput } from "../src/machinery.js";

const root = join(__dirname, "..", "..", "..", "content", "production", "1880");
const load = (rel: string) =>
  parse(readFileSync(join(root, rel), "utf8")) as Record<string, unknown>;

const components = decodeStrict(ShipComponentCatalogueSchema, load("ship-building/components.yaml"))
  .components as ComponentDef[];
const plants = decodeStrict(PropulsionPlantCatalogueSchema, load("ship-building/plants.yaml"))
  .plants as unknown as PropulsionPlant[];
const hullRecords = decodeStrict(ShipHullFormCatalogueSchema, load("ship-building/hull-forms.yaml"))
  .hullForms as HullFormRecord[];
const balanceFile = load("ship-building/balance.yaml");
const ship = shipBalanceFromRecord(balanceFile.ship);
const techIds = new Set(
  (parse(readFileSync(join(root, "technologies.yaml"), "utf8")) as { id: string }[]).map(
    (t) => t.id,
  ),
);

describe("EARLY-band content integrity", () => {
  it("every component, plant and hull form passes its schema", () => {
    expect(components.length).toBeGreaterThanOrEqual(20);
    expect(plants.length).toBeGreaterThanOrEqual(3);
    expect(hullRecords).toHaveLength(10);
  });
  it("the catalogue lints clean against the real 1880 technology ids", () => {
    expect(lintCatalogue(components, techIds)).toEqual([]);
    for (const p of plants)
      for (const t of p.requires ?? []) expect(techIds.has(t), `${p.id} requires ${t}`).toBe(true);
  });
  it("covers the vertical-slice minimums: >=10 weapons, torpedo mounts, >=3 plants, 4 armour materials", () => {
    const weapons = components.filter((c) =>
      ["MAIN_GUN", "SECONDARY_GUN", "TORPEDO_TUBE"].includes(c.category),
    );
    expect(weapons.length).toBeGreaterThanOrEqual(10);
    expect(
      components
        .filter((c) => c.category === "TORPEDO_TUBE")
        .map((c) => c.torpedoMount?.mountType ?? "")
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    ).toEqual(["ABOVE_WATER_TRAINABLE", "ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED"]);
    expect(plants.length).toBeGreaterThanOrEqual(3);
    for (const m of ["compound", "steel", "nickel_steel", "harvey"])
      expect(ship.armour.materialEffBp[m]).toBeGreaterThan(0);
  });
  it("no weapon is introduced before 1880 and dates follow the research note", () => {
    for (const c of components) expect(c.introduction.fromMonth >= "1880-01", c.id).toBe(true);
    const by = new Map(components.map((c) => [c.id, c]));
    expect(by.get("gun_bl_12in_35")!.introduction.fromMonth).toBe("1895-01");
    expect(by.get("gun_qf_6in_40")!.introduction.fromMonth).toBe("1892-01");
    expect(by.get("gun_qf_12pdr")!.introduction.fromMonth).toBe("1894-01");
  });
  it("gun figures match the research tables (spot checks)", () => {
    const by = new Map(components.map((c) => [c.id, c]));
    expect(by.get("gun_bl_12in_25")!.constants.gun_kg).toBe(44_500);
    expect(by.get("gun_bl_135in_30")!.attributes!.shellMassG).toBe("567000");
    expect(by.get("gun_qf_47in")!.attributes!.shellMassG).toBe("20400");
    expect(by.get("gun_maxim_303")!.attributes!.shellMassG).toBe("14");
    expect(by.get("gun_bl_12in_25")!.attributes!.caliberUm).toBe("305000");
  });
  it("plants carry the sourced specific masses and become more efficient over time", () => {
    const w = (id: string) => plants.find((p) => p.id === id)!.weightMilliKgPerKw / 1000;
    expect(w("compound_cylindrical")).toBe(195);
    expect(w("triple_expansion_cylindrical")).toBe(170);
    expect(w("locomotive_boiler_tb")).toBe(46);
    expect(w("triple_expansion_watertube")).toBeLessThan(w("triple_expansion_cylindrical"));
    expect(w("compound_cylindrical")).toBeGreaterThan(w("triple_expansion_cylindrical"));
  });
  it("hull-form conversion preserves shares, rejects duplicates, and balance shape is checked", () => {
    const forms = hullFormsFromRecords(hullRecords);
    expect(Object.keys(forms).sort()).toEqual([
      "coast_defence_form",
      "destroyer_form",
      "fast_battleship_form",
      "heavy_cruiser_form",
      "light_cruiser_form",
      "merchant_liner_form",
      "postwar_destroyer_form",
      "pre_dreadnought_form",
      "protected_cruiser_form",
      "torpedo_boat_form",
    ]);
    expect(forms.torpedo_boat_form!.buoyancyByZoneBp.reduce((a, v) => a + v, 0)).toBe(10_000);
    expect(() => hullFormsFromRecords([hullRecords[0]!, hullRecords[0]!])).toThrowError(
      ContentError,
    );
    expect(() => shipBalanceFromRecord({})).toThrowError(ContentError);
  });
});

describe("calibration against sourced ships", () => {
  const forms = hullFormsFromRecords(hullRecords);
  const hullShare = (formId: string, L: number, B: number, D: number, dispKg: number) => {
    const f = forms[formId]!.form;
    const w = hullStructureWeight(
      {
        hullFormId: formId,
        lengthWl: mm(L * 1000),
        beam: mm(Math.round(B * 1000)),
        draught: mm(1000),
        depthToMainDeck: mm(D * 1000),
        blockCoeffBp: bp(5000),
        materialId: "mild_steel",
        structuralSchemeId: "mixed",
        subdivisionGrade: 2,
        targetDisplacementKg: kg(dispKg),
        limitDisplacementKg: null,
        designMarginBp: bp(0),
        growthReserveBp: bp(0),
      },
      f,
      ship.hull,
    );
    return (w * 100) / dispKg;
  };
  it("hull weight fractions reproduce White 1894 (BB 38 %, CA 38 %, coast-defence 31 %, torpedo boat 33 %) within 1 point", () => {
    expect(hullShare("pre_dreadnought_form", 118.9, 22.9, 14.0, 15_139_000)).toBeCloseTo(38, 0);
    expect(hullShare("protected_cruiser_form", 110, 18.3, 11.3, 7_823_000)).toBeCloseTo(38, 0);
    expect(hullShare("coast_defence_form", 76.4, 14.9, 8.4, 3_500_000)).toBeCloseTo(31, 0);
    expect(hullShare("torpedo_boat_form", 54.9, 5.64, 4.0, 244_000)).toBeCloseTo(33, 0);
  });
  it("the merchant-liner hull fraction reproduces White 1894's passenger-steamer 47.6 % (formBp 13400)", () => {
    expect(hullShare("merchant_liner_form", 152.4, 16.46, 12.19, 12_500_000)).toBeCloseTo(47.6, 0);
  });
  it("the merchant-liner Admiralty coefficient sits inside the sourced 25,000-29,000 liner range", () => {
    const c = ship.machinery.cFormX100.merchant_liner_form!;
    expect(c).toBeGreaterThanOrEqual(25_000);
    expect(c).toBeLessThanOrEqual(29_000);
  });
  it("the merchant-liner L/B band covers the sourced 1880s liners (Oregon 9.26, Campania 9.09)", () => {
    const form = forms.merchant_liner_form!.form;
    expect(form.lbMinX100).toBeLessThanOrEqual(818);
    expect(form.lbMaxX100).toBeGreaterThanOrEqual(926);
  });
  const power = (formId: string, L: number, dispT: number, knots: number) => {
    const i = {
      plant: plants[0]!,
      installedKw: 1,
      hullFormId: formId,
      lengthWlMm: L * 1000,
      displacementKg: dispT * 1000,
      foulingBp: 0,
      fuelCapacityKg: 0,
      cruiseSpeedMilliKnots: 10_000,
      requiredSpeedMilliKnots: 10_000,
      requiredRangeNm: 0,
    } satisfies MachineryInput;
    return requiredKw(i, ship.machinery, knots * 1000) / 0.7457;
  };
  const cases: [string, string, number, number, number, number][] = [
    ["Royal Sovereign", "pre_dreadnought_form", 115.8, 14_200, 16.77, 9_760],
    ["Majestic", "pre_dreadnought_form", 118.9, 14_900, 17, 12_000],
    ["Edgar", "protected_cruiser_form", 110, 7_700, 20, 12_000],
    ["Havock", "torpedo_boat_form", 54.9, 240, 26.77, 3_500],
    ["Siegfried", "coast_defence_form", 76.4, 3_445, 14.6, 4_500],
  ];
  for (const [name, form, L, disp, kn, ihp] of cases) {
    it(`predicted power for ${name} is within 15 % of the sourced indicated horsepower`, () => {
      const p = power(form, L, disp, kn);
      expect(p / ihp, `${name}: ${Math.round(p)} ihp vs ${ihp}`).toBeGreaterThan(0.85);
      expect(p / ihp, `${name}: ${Math.round(p)} ihp vs ${ihp}`).toBeLessThan(1.15);
    });
  }
});

describe("balance file", () => {
  it("does not add auxiliary machinery weight on top of White's complete-machinery figures", () => {
    expect(ship.machinery.auxWeightBp).toBe(0);
  });
});
