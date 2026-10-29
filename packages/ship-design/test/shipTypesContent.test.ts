import {} from "node:fs";
import { join } from "node:path";

import {
  SHIP_TYPE_DISPLAY_CATEGORIES,
  SHIP_TYPE_ERA_BANDS,
  SHIP_TYPE_HULL_TRAITS,
  SHIP_TYPE_ROLES,
  type EngineBehaviourClass,
  type ShipTypeRecord,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { readAuthoredFile } from "@bluewave/test-support";

import { CLASSIFIED_SHIP_TYPES } from "../src/classificationRules.js";
import { ERA_BANDS, SHIP_ROLES, SHIP_TYPE_IDS, type ShipTypeDefinition } from "../src/shipTypes.js";
import { SHIP_TYPES, SHIP_TYPE_CATEGORIES, type ShipTypeId } from "../src/index.js";

const path = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
  "ship-types.ts",
);

function readShipTypeRecords(): ShipTypeRecord[] {
  return (readAuthoredFile(path) as { shipTypes: ShipTypeRecord[] }).shipTypes;
}

const records = readShipTypeRecords();
const byId = new Map(records.map((record) => [record.id, record] as const));

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
      expect(record.classification.requires, id).toEqual([]);
    }
  });

  it("keeps the schema vocabularies in step with the domain vocabularies", () => {
    expect([...SHIP_TYPE_ROLES]).toEqual([...SHIP_ROLES]);
    expect([...SHIP_TYPE_DISPLAY_CATEGORIES]).toEqual([...SHIP_TYPE_CATEGORIES]);
    expect([...SHIP_TYPE_ERA_BANDS]).toEqual([...ERA_BANDS]);
    expect([...SHIP_TYPE_HULL_TRAITS]).toEqual(["merchant_derived"]);
  });
});
