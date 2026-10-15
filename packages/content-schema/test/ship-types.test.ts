import { describe, expect, it } from "vite-plus/test";

import { ShipTypeRecordSchema, decodeStrictResult } from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

/**
 * The ship-type-as-content contract (ADR-0156, ship-part-model ticket 12a). Every
 * vocabulary is closed and decoded strictly, so a content string cannot name an engine
 * behaviour class, display category, role, era, torpedo policy or classification
 * predicate that code does not own. Expectations come from ADR-0156, not the schema.
 */

const provenance = {
  sourceStatus: "DERIVED",
  confidence: "HIGH",
  kind: "game_conversion",
  sources: [],
};

const valid = {
  id: "B",
  name: "Pre-dreadnought battleship",
  engineClass: "capital_combatant",
  displayCategory: "CAPITAL_SHIP",
  roles: ["BATTLE_LINE", "COASTAL_DEFENCE"],
  era: "EARLY",
  availability: {
    fromEra: "EARLY",
    requiresTech: null,
    requiresCapability: null,
    mechanicsImplemented: true,
  },
  classification: { precedence: 20, requires: [] },
  torpedoPolicy: "OPTIONAL",
  relativeCost: 5,
  relativeBuildTime: 5,
  auxiliary: false,
  requiredHullTrait: null,
  presentation: {
    description: "The battle-line capital ship of the period.",
    recommendedUse: "Anchor the battle line.",
    weaknesses: "Slow and expensive.",
    armourProfile: "Heavy belt",
    armamentProfile: "Heavy guns",
  },
  order: 10,
  provenance,
};

/** The valid record with one fit-requirement predicate on its classification. */
function withRequires(predicates: unknown[]): Record<string, unknown> {
  return { ...valid, classification: { precedence: 20, requires: predicates } };
}

const VALID_PREDICATE = {
  slot: "main",
  interface: "gun_mount",
  constraints: { calibreInchesMin: 9 },
  mountCountMin: 1,
};

describe("a valid ship-type record decodes", () => {
  it("accepts the canonical shape with an empty predicate list", () => {
    expect(decodeOk(ShipTypeRecordSchema, valid)).toBe(true);
  });

  it("accepts a closed classification predicate", () => {
    expect(decodeOk(ShipTypeRecordSchema, withRequires([VALID_PREDICATE]))).toBe(true);
  });

  it("accepts a dotted platform slot id in a classification predicate (ticket 12b)", () => {
    // The platform slot ids every real loadout uses are dotted (`SlotSchema.id` and the
    // loadout entries share the same `slotId` schema), so a requirement must be able to
    // name one; a bare `stableId` would have made every authored requirement inert.
    expect(
      decodeOk(
        ShipTypeRecordSchema,
        withRequires([{ ...VALID_PREDICATE, slot: "forecastle.gun_mount" }]),
      ),
    ).toBe(true);
    expect(
      decodeOk(
        ShipTypeRecordSchema,
        withRequires([{ ...VALID_PREDICATE, slot: "armour.belt_main" }]),
      ),
    ).toBe(true);
  });

  it("accepts a null required hull trait and a merchant-derived trait", () => {
    expect(decodeOk(ShipTypeRecordSchema, { ...valid, requiredHullTrait: null })).toBe(true);
    expect(
      decodeOk(ShipTypeRecordSchema, { ...valid, requiredHullTrait: "merchant_derived" }),
    ).toBe(true);
  });
});

describe("an unknown closed-vocabulary value or key fails strict decoding", () => {
  it.each([
    ["engine behaviour class", { ...valid, engineClass: "carrier_group" }],
    ["display category", { ...valid, displayCategory: "BATTLESHIP" }],
    ["role", { ...valid, roles: ["BATTLE_LINE", "ESCORT"] }],
    ["era band", { ...valid, era: "MODERN" }],
    ["torpedo policy", { ...valid, torpedoPolicy: "FORBIDDEN" }],
    ["hull trait", { ...valid, requiredHullTrait: "wooden_walls" }],
    ["top-level key", { ...valid, extra: 1 }],
    ["presentation key", { ...valid, presentation: { ...valid.presentation, motto: "x" } }],
    [
      "availability key",
      { ...valid, availability: { ...valid.availability, fromMonth: "1880-01" } },
    ],
  ])("rejects an unknown %s", (_label, record) => {
    expect(decodeOk(ShipTypeRecordSchema, record)).toBe(false);
  });

  it.each([
    ["predicate key", { ...VALID_PREDICATE, displacementKgMin: 1 }],
    ["constraint key", { ...VALID_PREDICATE, constraints: { bogusConstraint: 1 } }],
    ["interface", { ...VALID_PREDICATE, interface: "laser" }],
    ["slot token", { ...VALID_PREDICATE, slot: "Main" }],
    ["dotted slot token", { ...VALID_PREDICATE, slot: "forecastle.gun-mount" }],
  ])("rejects an unknown %s inside classification.requires", (_label, predicate) => {
    const record = withRequires([predicate]);
    expect(decodeOk(ShipTypeRecordSchema, record)).toBe(false);
    expect(decodeIssue(ShipTypeRecordSchema, record)).toContain("classification");
  });

  it("rejects a non-positive mountCountMin", () => {
    expect(
      decodeOk(ShipTypeRecordSchema, withRequires([{ ...VALID_PREDICATE, mountCountMin: 0 }])),
    ).toBe(false);
  });

  it("rejects a relative cost outside 1..5", () => {
    expect(decodeOk(ShipTypeRecordSchema, { ...valid, relativeCost: 6 })).toBe(false);
    expect(decodeOk(ShipTypeRecordSchema, { ...valid, relativeBuildTime: 0 })).toBe(false);
  });

  it("rejects an id that is not an upper-case ship-type token", () => {
    expect(decodeOk(ShipTypeRecordSchema, { ...valid, id: "b" })).toBe(false);
  });

  it("reports the failing path for an unknown engine class", () => {
    const result = decodeStrictResult(ShipTypeRecordSchema, {
      ...valid,
      engineClass: "carrier_group",
    });
    expect(result._tag).toBe("Failure");
  });
});
