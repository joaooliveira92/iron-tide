import { describe, it, expect } from "vite-plus/test";
import {
  ACCOMMODATION_STANDARDS,
  ARMOUR_REGION_IDS,
  ARMOUR_SCHEME_IDS as CONTENT_ARMOUR_SCHEME_IDS,
  MOUNT_SIDES,
  ShipComponentSchema,
  SHIP_COMPONENT_CATEGORIES,
  SHIP_ZONE_IDS,
  PropulsionPlantSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import {
  ARMOUR_REGIONS,
  ARMOUR_SCHEME_IDS,
  COMPONENT_CATEGORIES,
  ZONE_IDS,
  lintCatalogue,
  type AccommodationStandard,
  type ComponentDef,
  type MountSide,
  type PropulsionPlant,
} from "../src/index.js";
import { catalogue, plant } from "./fixtures/gunboat.js";

describe("content-schema stays in lock-step with ship-design", () => {
  it("category and zone lists are identical", () => {
    expect([...SHIP_COMPONENT_CATEGORIES]).toEqual([...COMPONENT_CATEGORIES]);
    expect([...SHIP_ZONE_IDS]).toEqual([...ZONE_IDS]);
    expect(COMPONENT_CATEGORIES as readonly string[]).toContain("TERTIARY_GUN");
    expect(SHIP_COMPONENT_CATEGORIES as readonly string[]).toContain("TERTIARY_GUN");
  });
  it("reference-design enum lists are identical", () => {
    expect([...ARMOUR_REGION_IDS]).toEqual([...ARMOUR_REGIONS]);
    expect([...CONTENT_ARMOUR_SCHEME_IDS]).toEqual([...ARMOUR_SCHEME_IDS]);
    expect(new Set(ARMOUR_REGIONS).size).toBe(ARMOUR_REGIONS.length);
    expect(ARMOUR_REGIONS as readonly string[]).not.toContain("BARBETTE");
    expect(ARMOUR_REGIONS as readonly string[]).not.toContain("TURRET_FACE");
    for (const r of ["DECK_EXTENDED", "TURRET", "TURRET_TOP", "SECONDARY_GUN"])
      expect(ARMOUR_REGIONS as readonly string[]).toContain(r);
    // Type-level parity: these only compile if the lists match ship-design.
    const sides: readonly MountSide[] = [...MOUNT_SIDES];
    const standards: readonly AccommodationStandard[] = [...ACCOMMODATION_STANDARDS];
    expect(sides).toHaveLength(3);
    expect(standards).toHaveLength(3);
  });
  it("every fixture component passes the schema, and parsed output is a valid ComponentDef that lints clean", () => {
    const parsed: ComponentDef[] = catalogue.map(
      (c) => decodeStrict(ShipComponentSchema, c) as ComponentDef,
    );
    expect(lintCatalogue(parsed, new Set(["tech_qf_guns", "tech_whitehead"]))).toEqual([]);
  });
  it("plants parse into the runtime shape", () => {
    const decoded = decodeStrict(PropulsionPlantSchema, {
      ...plant,
      introduction: { fromMonth: "1881-01", obsoleteMonth: null },
      requires: [],
    });
    const p: PropulsionPlant = {
      id: decoded.id,
      fuelType: decoded.fuelType,
      weightMilliKgPerKw: decoded.weightMilliKgPerKw,
      volumeLitrePerKw: decoded.volumeLitrePerKw,
      sfcGramPerKwh: decoded.sfcGramPerKwh as never,
      reliabilityBp: decoded.reliabilityBp,
      minKw: decoded.minKw,
      maxKw: decoded.maxKw,
    };
    expect(p.id).toBe(plant.id);
  });
});
