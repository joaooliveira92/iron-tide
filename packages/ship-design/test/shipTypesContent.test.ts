import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SHIP_TYPE_DISPLAY_CATEGORIES,
  SHIP_TYPE_ERA_BANDS,
  SHIP_TYPE_HULL_TRAITS,
  SHIP_TYPE_ROLES,
  ShipTypeRecordSchema,
  decodeStrict,
  parseYamlSafe,
  type EngineBehaviourClass,
  type ShipTypeRecord,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";

import {
  CLASSIFIED_SHIP_TYPES,
  ERA_BANDS,
  SHIP_ROLES,
  SHIP_TYPES,
  SHIP_TYPE_CATEGORIES,
  SHIP_TYPE_IDS,
  type ShipTypeDefinition,
  type ShipTypeId,
} from "../src/index.js";

/**
 * The authored 1880 ship-type content reproduces the code registry exactly (ADR-0156,
 * ship-part-model ticket 12a). This is the regression that lets ticket 12b flip the
 * classifier's source from `shipTypeData.ts` to the compiled registry: every field of
 * every one of the fourteen records must equal its `SHIP_TYPES` counterpart, and the
 * classification `precedence` must reproduce `CLASSIFIED_SHIP_TYPES` order.
 */

const path = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
  "ship-types.yaml",
);

function readShipTypeRecords(): ShipTypeRecord[] {
  const collector = { addError: () => undefined, hasErrors: false } as never;
  const parsed = parseYamlSafe(readFileSync(path, "utf8"), path, collector);
  if (!parsed.success) throw new Error(`bad YAML: ${path}`);
  const records = (parsed.data as { shipTypes: unknown[] }).shipTypes;
  return records.map((record) => decodeStrict(ShipTypeRecordSchema, record));
}

const records = readShipTypeRecords();
const byId = new Map(records.map((record) => [record.id, record] as const));

/** The seven closed engine behaviour classes each canonical type maps to (ADR-0156 §2). */
const ENGINE_CLASS: Readonly<Record<ShipTypeId, EngineBehaviourClass>> = {
  B: "capital_combatant",
  CA: "cruiser",
  CL: "cruiser",
  DD: "torpedo_craft",
  KE: "colonial_vessel",
  AMC: "merchant_auxiliary",
  BB: "capital_combatant",
  BC: "capital_combatant",
  CVL: "aviation",
  CV: "aviation",
  AV: "aviation",
  SS: "submarine",
  MTB: "torpedo_craft",
  TR: "merchant_auxiliary",
};

/** The record fields that mirror a code-registry entry, in a comparable shape. */
function fromRecord(record: ShipTypeRecord) {
  return {
    name: record.name,
    displayCategory: record.displayCategory,
    roles: record.roles,
    era: record.era,
    availability: record.availability,
    torpedoPolicy: record.torpedoPolicy,
    relativeCost: record.relativeCost,
    relativeBuildTime: record.relativeBuildTime,
    auxiliary: record.auxiliary,
    requiredHullTrait: record.requiredHullTrait,
    presentation: record.presentation,
    order: record.order,
  };
}

function fromCode(type: ShipTypeDefinition) {
  return {
    name: type.name,
    displayCategory: type.category,
    roles: type.roles,
    era: type.era,
    availability: {
      fromEra: type.availability.fromEra,
      requiresTech: type.availability.requiresTech,
      requiresCapability: type.availability.requiresCapability,
      mechanicsImplemented: type.availability.mechanicsImplemented,
    },
    torpedoPolicy: type.torpedoes,
    relativeCost: type.relativeCost,
    relativeBuildTime: type.relativeBuildTime,
    auxiliary: type.auxiliary,
    requiredHullTrait: type.requiredHullTrait,
    presentation: {
      description: type.description,
      recommendedUse: type.recommendedUse,
      weaknesses: type.weaknesses,
      armourProfile: type.armourProfile,
      armamentProfile: type.armamentProfile,
    },
    order: type.order,
  };
}

describe("the 1880 ship-type content reproduces the code registry (ticket 12a)", () => {
  it("carries exactly the fourteen canonical types", () => {
    expect(records).toHaveLength(14);
    expect([...byId.keys()].sort()).toEqual([...SHIP_TYPE_IDS].sort());
  });

  it.each(SHIP_TYPE_IDS)("%s mirrors its SHIP_TYPES entry field for field", (id) => {
    expect(byId.get(id), id).toBeDefined();
    expect(fromRecord(byId.get(id)!)).toEqual(fromCode(SHIP_TYPES[id]));
  });

  it.each(SHIP_TYPE_IDS)("%s names the expected engine behaviour class", (id) => {
    expect(byId.get(id)?.engineClass).toBe(ENGINE_CLASS[id]);
  });

  it("covers all seven engine behaviour classes and no others", () => {
    expect(new Set(records.map((record) => record.engineClass))).toEqual(
      new Set(Object.values(ENGINE_CLASS)),
    );
  });

  it("carries no duplicate ids", () => {
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
  });

  it("reproduces the natural classifier's precedence order exactly", () => {
    const ordered = [...CLASSIFIED_SHIP_TYPES]
      .map((id) => ({ id, precedence: byId.get(id)!.classification.precedence }))
      .sort((a, b) => a.precedence - b.precedence)
      .map((entry) => entry.id);
    expect(ordered).toEqual([...CLASSIFIED_SHIP_TYPES]);
  });

  it("places every unclassified type above precedence 100 and authors no predicate yet", () => {
    for (const id of SHIP_TYPE_IDS) {
      const record = byId.get(id)!;
      if (!(CLASSIFIED_SHIP_TYPES as readonly string[]).includes(id)) {
        expect(record.classification.precedence, id).toBeGreaterThan(100);
      }
      // Classification is still code-owned until 12b; every record's `requires` is empty.
      expect(record.classification.requires, id).toEqual([]);
    }
  });

  it("keeps the schema vocabularies in step with the domain vocabularies", () => {
    // The schema package cannot depend on ship-design, so it restates the closed
    // vocabularies. This pins them equal member-for-member so a new role, category or
    // era band cannot drift between the two.
    expect([...SHIP_TYPE_ROLES]).toEqual([...SHIP_ROLES]);
    expect([...SHIP_TYPE_DISPLAY_CATEGORIES]).toEqual([...SHIP_TYPE_CATEGORIES]);
    expect([...SHIP_TYPE_ERA_BANDS]).toEqual([...ERA_BANDS]);
    expect([...SHIP_TYPE_HULL_TRAITS]).toEqual(["merchant_derived"]);
  });
});
