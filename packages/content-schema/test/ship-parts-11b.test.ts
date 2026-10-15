/**
 * The 11b schema homes (ship-part-model ticket 11b, ADR-0154 §19): engineering, capabilities,
 * metadata tags, entry units, the rounds/magazineRef homes, the design header and the reusable
 * quantity kinds. Expectations are the directed boundaries, not the schema code.
 */
import { describe, expect, it } from "vite-plus/test";

import {
  ACCOUNTING_QUANTITY_KINDS,
  CapabilitiesSchema,
  DesignHeaderSchema,
  EngineeringSchema,
  FlattenedPartSchema,
  LoadoutEntrySchema,
  PART_LOCAL_DATUMS,
  PART_TAGS,
  QUANTITY_KINDS,
  QuantityComponentSchema,
  decodeStrict,
} from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
};

const baseGun = {
  id: "bl_12in_25",
  family: "gun",
  provides: "gun",
  name: "BL 12-inch 25-ton",
  lifecycle: { availableFrom: "1885-01" },
  spec: { calibreUm: 305_000 },
  quantities: [{ id: "gun_mass", kind: "massKg", value: 44_500, basis: "PER_PART_UNIT" }],
  revisions: [],
  origin: { sourceFile: "ship-building/components.yaml" },
  provenance,
};

describe("quantity kinds (SPM-R5 extension)", () => {
  it("adds only lengthMm and powerKw to the accounting kinds", () => {
    expect(QUANTITY_KINDS).toEqual([...ACCOUNTING_QUANTITY_KINDS, "lengthMm", "powerKw"]);
    for (const kind of ["lengthMm", "powerKw"] as const) {
      expect(ACCOUNTING_QUANTITY_KINDS).not.toContain(kind);
    }
  });

  it("a quantity component carries an accounting kind only", () => {
    expect(
      decodeOk(QuantityComponentSchema, {
        id: "mass",
        kind: "massKg",
        value: 1,
        basis: "PER_PART_UNIT",
      }),
    ).toBe(true);
    expect(
      decodeIssue(QuantityComponentSchema, {
        id: "len",
        kind: "lengthMm",
        value: 1,
        basis: "PER_PART_UNIT",
      }),
    ).not.toBe("");
  });
});

describe("engineering (physical, power, cooling)", () => {
  it("records physical extent with a part-local datum", () => {
    expect(PART_LOCAL_DATUMS).toEqual(["PART_BASE"]);
    const part = {
      ...baseGun,
      engineering: {
        physical: { envelopeHeightMm: 4_000, centreOfGravity: { zMm: 1_500, datum: "PART_BASE" } },
      },
    };
    expect(decodeStrict(FlattenedPartSchema, part)).toEqual(part);
    expect(
      decodeIssue(FlattenedPartSchema, {
        ...baseGun,
        engineering: { physical: { envelopeHeightMm: 4_000, centreOfGravity: { zMm: 1_500 } } },
      }),
    ).not.toBe("");
  });

  it("separates generation from consumption and forbids a sign for direction", () => {
    const parts = {
      generation: [{ id: "gen", kind: "powerKw", value: 500, basis: "PER_PART_UNIT" }],
    };
    const consumption = [{ id: "draw", kind: "powerKw", value: 120, basis: "PER_PART_UNIT" }];
    expect(decodeOk(EngineeringSchema, { power: { generation: parts.generation } })).toBe(true);
    expect(decodeOk(EngineeringSchema, { power: { consumption } })).toBe(true);
    expect(
      decodeOk(EngineeringSchema, { power: { generation: parts.generation, consumption } }),
    ).toBe(true);
    // An empty power block means nothing, and a negative value is a sign, not a direction.
    expect(decodeIssue(EngineeringSchema, { power: {} })).not.toBe("");
    expect(
      decodeIssue(EngineeringSchema, {
        power: {
          consumption: [{ id: "draw", kind: "powerKw", value: -1, basis: "PER_PART_UNIT" }],
        },
      }),
    ).not.toBe("");
  });
});

describe("capabilities (closed discriminated union)", () => {
  it("accepts one entry per kind, sorted by kind", () => {
    const list = [
      { kind: "damage_control", effectBp: 250 },
      { kind: "fire_control_class", class: "heavy" },
    ];
    expect(decodeStrict(CapabilitiesSchema, list)).toEqual(list);
  });

  it("rejects a duplicate kind, an unsorted list and an unknown kind", () => {
    expect(
      decodeIssue(CapabilitiesSchema, [
        { kind: "fire_control_class", class: "heavy" },
        { kind: "fire_control_class", class: "light" },
      ]),
    ).not.toBe("");
    expect(
      decodeIssue(CapabilitiesSchema, [
        { kind: "fire_control_class", class: "heavy" },
        { kind: "damage_control", effectBp: 250 },
      ]),
    ).not.toBe("");
    expect(decodeIssue(CapabilitiesSchema, [{ kind: "teleporter" }])).not.toBe("");
  });
});

describe("metadata tags (closed vocabulary)", () => {
  it("accepts a sorted, duplicate-free subset of the vocabulary", () => {
    const part = { ...baseGun, metadata: { displayName: "12-inch", tags: ["gun", "heavy"] } };
    expect(decodeStrict(FlattenedPartSchema, part)).toEqual(part);
    expect(PART_TAGS).toContain("gun");
  });

  it("rejects a duplicate, an unsorted list and an unknown tag", () => {
    const withTags = (tags: string[]) => ({
      ...baseGun,
      metadata: { tags },
    });
    expect(decodeIssue(FlattenedPartSchema, withTags(["gun", "gun"]))).not.toBe("");
    expect(decodeIssue(FlattenedPartSchema, withTags(["heavy", "gun"]))).not.toBe("");
    expect(decodeIssue(FlattenedPartSchema, withTags(["raygun"]))).not.toBe("");
  });
});

describe("entry units, rounds and magazineRef", () => {
  it("entryUnits is a positive, stepped installable range", () => {
    const part = { ...baseGun, entryUnits: { min: 1, max: 3, step: 1 } };
    expect(decodeStrict(FlattenedPartSchema, part)).toEqual(part);
    expect(
      decodeIssue(FlattenedPartSchema, { ...baseGun, entryUnits: { min: 0, max: 3, step: 1 } }),
    ).not.toBe("");
    expect(
      decodeIssue(FlattenedPartSchema, { ...baseGun, entryUnits: { min: 4, max: 3, step: 1 } }),
    ).not.toBe("");
  });

  it("an entry may name a magazine entry and carry a rounds parameter", () => {
    const entry = {
      id: "gun_main",
      slot: "forward.gun_mount",
      part: "bl_12in_barbette",
      mountCount: 1,
      magazineEntry: "mag_fwd",
      params: { rounds: 80 },
    };
    expect(decodeStrict(LoadoutEntrySchema, entry)).toEqual(entry);
  });
});

describe("the design header", () => {
  const header = {
    nation: "uk",
    requirement: {
      category: "BATTLESHIP",
      requiredSpeedMilliKnots: 15_000,
      cruiseSpeedMilliKnots: 10_000,
      requiredRangeNm: 3_000,
      designThreatId: "threat",
      modernizationExpectation: "MINOR",
      crewQualityBp: 5_000,
      accommodationStandard: "STANDARD",
    },
    hull: {
      hullFormId: "wide_form",
      lengthWl: 100_000,
      beam: 18_000,
      draught: 6_000,
      depthToMainDeck: 12_000,
      blockCoeffBp: 6_500,
      materialId: "steel",
      structuralSchemeId: "longitudinal",
      subdivisionGrade: 2,
      targetDisplacementKg: 10_000_000,
      limitDisplacementKg: null,
      designMarginBp: 500,
      growthReserveBp: 500,
    },
    machinery: {
      fuelCapacityKg: 500_000,
      fuelZoneId: "CENTRAL_MACHINERY",
      fuelStationPermille: 500,
      foulingBp: 0,
    },
    protection: {
      citadelLengthMm: 40_000,
      torpedoWarheadKg: 0,
      bunkerProtectionBp: 0,
    },
  };

  it("decodes the facts a loadout does not carry", () => {
    expect(decodeStrict(DesignHeaderSchema, header)).toEqual(header);
  });

  it("rejects an incomplete protection block and an unknown zone", () => {
    const { protection: _p, ...withoutProtection } = header;
    expect(decodeIssue(DesignHeaderSchema, withoutProtection)).not.toBe("");
    expect(
      decodeIssue(DesignHeaderSchema, {
        ...header,
        machinery: { ...header.machinery, fuelZoneId: "NOT_A_ZONE" },
      }),
    ).not.toBe("");
  });
});
