import { describe, it, expect } from "vite-plus/test";
import {
  ShipComponentSchema,
  ShipComponentCatalogueSchema,
  PropulsionPlantSchema,
  ShipHullFormSchema,
  SHIP_COMPONENT_CATEGORIES,
} from "../src/index.js";
import { decodeOk } from "./decode-helpers.js";

const comp = {
  id: "qf_47in",
  displayName: "4.7-inch QF",
  category: "SECONDARY_GUN",
  introduction: { fromMonth: "1887-01", obsoleteMonth: null },
  requires: ["tech_qf_guns"],
  parameters: { barrels: { min: 1, max: 2, step: 1 } },
  constants: { k: 3 },
  weightKg: "k * barrels",
  volumeLitre: "10",
  costMicro: "1",
  crew: "1",
  powerKw: "0",
  upgradePath: [],
  tags: [],
};

describe("ShipComponentSchema", () => {
  it("accepts a valid component and a catalogue", () => {
    expect(decodeOk(ShipComponentSchema, comp)).toBe(true);
    expect(decodeOk(ShipComponentCatalogueSchema, { components: [comp] })).toBe(true);
  });
  it("rejects unknown keys, bad ids, bad months, non-integer constants and unknown categories", () => {
    for (const bad of [
      { ...comp, extra: 1 },
      { ...comp, id: "Bad-Id" },
      { ...comp, introduction: { fromMonth: "1887-13", obsoleteMonth: null } },
      { ...comp, constants: { k: 1.5 } },
      { ...comp, category: "LASER" },
      { ...comp, parameters: { b: { min: 3, max: 1, step: 1 } } },
      { ...comp, allowedZones: ["BRIDGE"] },
    ])
      expect(decodeOk(ShipComponentSchema, bad)).toBe(false);
  });
  it("has 29 categories", () => {
    expect(SHIP_COMPONENT_CATEGORIES).toHaveLength(29);
  });
});

describe("plant and hull form", () => {
  const plant = {
    id: "triple_expansion",
    fuelType: "COAL",
    weightMilliKgPerKw: 40_000,
    volumeLitrePerKw: 150,
    sfcGramPerKwh: {
      points: [
        [0, 1400],
        [10000, 1000],
      ],
    },
    reliabilityBp: 9000,
    minKw: 200,
    maxKw: 40_000,
    introduction: { fromMonth: "1881-01", obsoleteMonth: null },
    requires: [],
  };
  it("validates plants", () => {
    expect(decodeOk(PropulsionPlantSchema, plant)).toBe(true);
    expect(decodeOk(PropulsionPlantSchema, { ...plant, minKw: 50_000 })).toBe(false);
    expect(decodeOk(PropulsionPlantSchema, { ...plant, reliabilityBp: 20_000 })).toBe(false);
  });
  const ids = [
    "FORECASTLE",
    "FWD_MAGAZINE",
    "FWD_SERVICE",
    "CENTRAL_MACHINERY",
    "SUPERSTRUCTURE",
    "AFT_SERVICE",
    "AFT_MAGAZINE",
    "QUARTERDECK",
    "MISSION",
  ] as const;
  const vol = [500, 1400, 1100, 2800, 1200, 1100, 1000, 700, 200];
  const form = {
    id: "fine_light",
    lengthMinMm: 40_000,
    lengthMaxMm: 260_000,
    lbMinX100: 700,
    lbMaxX100: 1300,
    formBp: 10_000,
    waterplaneCoeffBp: 7500,
    sheerBp: 11_000,
    volumeFullnessBp: 6000,
    deckFullnessBp: 7000,
    lcbPermille: 500,
    zones: ids.map((id, i) => ({
      id,
      startPermille: i * 100,
      endPermille: i * 100 + 100,
      volumeBp: vol[i]!,
      deckAreaBp: vol[i]!,
      buoyancyBp: vol[i]!,
    })),
  };
  it("requires nine zones whose shares sum to 10000", () => {
    expect(decodeOk(ShipHullFormSchema, form)).toBe(true);
    expect(decodeOk(ShipHullFormSchema, { ...form, zones: form.zones.slice(1) })).toBe(false);
    expect(
      decodeOk(ShipHullFormSchema, {
        ...form,
        zones: form.zones.map((z, i) => (i === 0 ? { ...z, volumeBp: 1 } : z)),
      }),
    ).toBe(false);
  });
});
