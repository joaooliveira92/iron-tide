import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ShipTypeRecordSchema,
  decodeStrict,
  parseYamlSafe,
  type ShipTypeRecord,
  type ShipTypeRequirement,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";

import {
  CLASSIFIED_SHIP_TYPES,
  DESIGN_22_EARLY,
  SHIP_TYPES,
  SHIP_TYPE_IDS,
  SHIP_TYPE_LIST,
  UM_PER_KNOT,
  evaluateShipTypeAvailability,
  naturalClass,
  shipTypeRegistryFromRecords,
  shipTypeRequirementsFor,
  type ClassFacts,
} from "../src/index.js";

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

const facts = (over: Partial<ClassFacts> = {}): ClassFacts => ({
  displacementKg: 2_400_000,
  speedUms: 25 * UM_PER_KNOT,
  beltUm: 0,
  anyQualifyingArmourUm: 0,
  maxMainGunUm: 0,
  maxGunUm: 0,
  mainTurretCount: 0,
  torpedoTubes: 0,
  aircraftCapacity: 0,
  deckUm: 0,
  maxHeavyMountBarrels: 0,
  merchantHull: false,
  ...over,
});

function swappedCruisers(): ShipTypeRecord[] {
  return records.map((record) => {
    if (record.id === "CL")
      return { ...record, classification: { ...record.classification, precedence: 70 } };
    if (record.id === "KE")
      return { ...record, classification: { ...record.classification, precedence: 50 } };
    return record;
  });
}

describe("the compiled ship-type registry (ticket 12b)", () => {
  it("maps every record to its code definition, engine class included", () => {
    const registry = shipTypeRegistryFromRecords(records);
    for (const id of SHIP_TYPE_IDS) {
      expect(registry.byId.get(id), id).toEqual(SHIP_TYPES[id]);
      expect(registry.byId.get(id)?.engineClass, id).toBe(SHIP_TYPES[id].engineClass);
    }
  });

  it("reproduces the classifier and roster orders", () => {
    const registry = shipTypeRegistryFromRecords(records);
    expect(registry.classified).toEqual([...CLASSIFIED_SHIP_TYPES]);
    expect(registry.list.map((d) => d.id)).toEqual(SHIP_TYPE_LIST.map((d) => d.id));
  });

  it("takes the natural-classifier order from content precedence", () => {
    const both = facts();
    expect(naturalClass(both, DESIGN_22_EARLY)).toBe("CL");
    expect(
      naturalClass(both, DESIGN_22_EARLY, shipTypeRegistryFromRecords(records).classified),
    ).toBe("CL");
    expect(
      naturalClass(
        both,
        DESIGN_22_EARLY,
        shipTypeRegistryFromRecords(swappedCruisers()).classified,
      ),
    ).toBe("KE");
  });

  it("falls back to the code registry when a context carries no records", () => {
    expect(shipTypeRequirementsFor({}, "CL")).toEqual([]);
    expect(shipTypeRequirementsFor({ shipTypes: records }, "B")).toEqual([]);
  });

  it("sources a type's fit requirements from its record", () => {
    const requirement: ShipTypeRequirement = {
      slot: "fwd_main",
      interface: "gun_mount",
      constraints: {},
    };
    const withRequirement = records.map((record) =>
      record.id === "CL"
        ? {
            ...record,
            classification: { ...record.classification, requires: [requirement] },
          }
        : record,
    );
    const found = shipTypeRequirementsFor({ shipTypes: withRequirement }, "CL");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ slot: "fwd_main", interface: "gun_mount" });
  });

  it("reads availability facts from the compiled definitions", () => {
    const earlyBB = records.map((record) =>
      record.id === "BB"
        ? {
            ...record,
            availability: {
              fromEra: "EARLY" as const,
              requiresTech: null,
              requiresCapability: null,
              mechanicsImplemented: true,
            },
          }
        : record,
    );
    const registry = shipTypeRegistryFromRecords(earlyBB);
    const context = { month: "1880-01", unlockedTechs: new Set<string>() };
    expect(evaluateShipTypeAvailability("BB", context).available).toBe(false);
    expect(
      evaluateShipTypeAvailability("BB", { ...context, definitions: registry.byId }).available,
    ).toBe(true);
  });
});
