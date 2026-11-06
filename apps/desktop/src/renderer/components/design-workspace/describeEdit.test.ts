import { describe, expect, it } from "vite-plus/test";
import { mm, type ArmourRegion, type DraftEdit } from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { describeEdit } from "./describeEdit.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const CTX = { nameOf: (id: string) => (id === "GUN_6IN" ? "6-inch gun" : id) };

const ARMOUR_REGION: ArmourRegion = {
  region: "BELT_UPPER",
  thicknessUm: 152_400,
  lengthMm: 30_000,
  heightMm: 4_000,
  materialId: "CEMENTED_STEEL",
  cosObliquityBp: 10_000,
};

const SAMPLES: Record<DraftEdit["kind"], DraftEdit> = {
  set_hull: { kind: "set_hull", patch: { lengthWl: mm(120_000), subdivisionGrade: 2 } },
  set_machinery: {
    kind: "set_machinery",
    patch: {
      installedKw: 9_000,
      zoneId: "CENTRAL_MACHINERY",
      stationPermille: 450,
      foulingBp: 300,
    },
  },
  set_fire_control: { kind: "set_fire_control", positions: 3 },
  set_colonial_service: { kind: "set_colonial_service", fitted: true },
  set_aluminium_superstructure: { kind: "set_aluminium_superstructure", fitted: false },
  set_anti_aircraft: {
    kind: "set_anti_aircraft",
    antiAircraft: { lightGuns: 4, mediumGuns: 2, directors: 1 },
  },
  set_tertiary: { kind: "set_tertiary", tertiary: { count: 6, caliberUm: 76_200 } },
  set_requirement: {
    kind: "set_requirement",
    patch: {
      category: "CA",
      requiredSpeedMilliKnots: 22_000,
      requiredRangeNm: 6_000,
      accommodationStandard: "STANDARD",
    },
  },
  add_placement: {
    kind: "add_placement",
    placement: {
      instanceId: "gun_1",
      componentId: "GUN_6IN",
      zoneId: "FORECASTLE",
      stationPermille: 250,
    },
  },
  remove_placement: { kind: "remove_placement", instanceId: "gun_1" },
  move_placement: {
    kind: "move_placement",
    instanceId: "gun_1",
    zoneId: "FORECASTLE",
    stationPermille: 250,
  },
  set_param: { kind: "set_param", instanceId: "gun_1", param: "elevationDeg", value: 15 },
  set_armour_region: { kind: "set_armour_region", region: ARMOUR_REGION },
  remove_armour_region: { kind: "remove_armour_region", region: "BELT_UPPER" },
  set_side: { kind: "set_side", instanceId: "gun_1", side: "PORT" },
  batch: {
    kind: "batch",
    edits: [
      { kind: "set_fire_control", positions: 2 },
      { kind: "set_colonial_service", fitted: true },
    ],
  },
  set_armour_regions: { kind: "set_armour_regions", regions: [ARMOUR_REGION] },
  set_armour_scheme: { kind: "set_armour_scheme", schemeId: "FLAT_DECK_ON_BELT", regions: [] },
};

describe("describeEdit: plain language for every edit kind", () => {
  for (const [kind, edit] of Object.entries(SAMPLES)) {
    it(`${kind} reads as words, with no codes, keys or internal units`, () => {
      const text = describeEdit(edit, CTX, FORMAT);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/_/);
      expect(text).not.toMatch(/[a-z][A-Z]/);
      expect(text).not.toMatch(/[{}‰]/);
      expect(text).not.toContain("gun_1");
      expect(text).not.toContain("152400");
      expect(text).not.toContain("120000");
    });
  }
});

describe("describeEdit: fire control", () => {
  it("names the position count, singular and plural", () => {
    expect(describeEdit({ kind: "set_fire_control", positions: 1 }, CTX, FORMAT)).toBe(
      "Fire control set to 1 position",
    );
    expect(describeEdit({ kind: "set_fire_control", positions: 3 }, CTX, FORMAT)).toBe(
      "Fire control set to 3 positions",
    );
  });
});

describe("describeEdit: colonial service", () => {
  it("says whether the ship is fitted", () => {
    expect(describeEdit({ kind: "set_colonial_service", fitted: true }, CTX, FORMAT)).toBe(
      "Fit for colonial service",
    );
    expect(describeEdit({ kind: "set_colonial_service", fitted: false }, CTX, FORMAT)).toBe(
      "Remove the colonial-service fitting",
    );
  });
});

describe("describeEdit: armour scheme", () => {
  it("names the scheme in words", () => {
    expect(
      describeEdit(
        { kind: "set_armour_scheme", schemeId: "FLAT_DECK_ON_BELT", regions: [] },
        CTX,
        FORMAT,
      ),
    ).toBe("Armour scheme: flat deck on belt");
  });
});

describe("describeEdit: hull and requirement values", () => {
  it("shows the length in the player's unit, not in micro or millimetre units", () => {
    const text = describeEdit({ kind: "set_hull", patch: { lengthWl: mm(120_000) } }, CTX, FORMAT);
    expect(text.startsWith("Length (waterline) set to ")).toBe(true);
    expect(text).toMatch(/yd|m$/);
  });

  it("names the ship type in words", () => {
    expect(
      describeEdit({ kind: "set_requirement", patch: { category: "CA" } }, CTX, FORMAT),
    ).toMatch(/^Ship type set to \S/);
  });
});
