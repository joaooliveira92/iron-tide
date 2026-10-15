import { describe, expect, it } from "vite-plus/test";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  DesignTemplateSchema,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
  TechnologyPrerequisiteChainSchema,
} from "../src/index.js";
import { decodeOk } from "./decode-helpers.js";

describe("DesignTemplateSchema", () => {
  it("accepts a valid design template", () => {
    const valid = {
      designId: "gbr-dreadnought-v1",
      nationId: "GBR",
      className: "Dreadnought",
      hullType: "battleship",
      displacementKg: 18_000,
      speedUms: 11,
      armorBeltUm: 300,
      mainGuns: { caliber: 305, count: 10, mounts: 5 },
      machineryType: "steam_turbine",
      hitPoints: 100,
      crewComplement: 800,
    };
    expect(decodeOk(DesignTemplateSchema, valid)).toBe(true);
  });

  it("P-1 AC-1: accepts torpedoArmament and rejects bad mounts", () => {
    const base = {
      designId: "gbr-inflexible",
      nationId: "uk",
      className: "Inflexible",
      hullType: "ironclad_turret_ship",
      displacementKg: 11_880_000,
      speedUms: 14,
      armorBeltUm: 610,
      mainGuns: { caliber: 406, count: 4, mounts: 2 },
      machineryType: "reciprocating_compound",
      hitPoints: 60,
      crewComplement: 460,
    };
    const mount = {
      mountType: "UNDERWATER_FIXED",
      tubeCount: 2,
      torpedoModelId: "whitehead_14in_1886",
    };
    expect(decodeOk(DesignTemplateSchema, { ...base, torpedoArmament: [mount] })).toBe(true);
    for (const bad of [
      [{ ...mount, mountType: "DECK" }],
      [{ ...mount, tubeCount: 0 }],
      [{ ...mount, torpedoModelId: "" }],
      [{ ...mount, extra: 1 }],
      [],
    ]) {
      expect(decodeOk(DesignTemplateSchema, { ...base, torpedoArmament: bad })).toBe(false);
    }
  });

  it("rejects a template missing required fields", () => {
    const invalid = { designId: "gbr-dreadnought-v1", className: "Dreadnought" };
    expect(decodeOk(DesignTemplateSchema, invalid)).toBe(false);
  });

  it("rejects a template with invalid main gun values", () => {
    const invalid = {
      designId: "gbr-dreadnought-v1",
      nationId: "GBR",
      className: "Dreadnought",
      hullType: "battleship",
      displacementKg: 18_000,
      speedUms: 11,
      armorBeltUm: 300,
      mainGuns: { caliber: 0, count: 10, mounts: 5 },
      machineryType: "steam_turbine",
      hitPoints: 100,
      crewComplement: 800,
    };
    expect(decodeOk(DesignTemplateSchema, invalid)).toBe(false);
  });
});

describe("TechnologyPrerequisiteChainSchema", () => {
  it("accepts the expanded research fields", () => {
    const valid = {
      id: "basic_gunnery",
      name: "Basic Gunnery",
      category: "weapons",
      researchFieldId: "GUNNERY",
      prerequisites: [],
      cost: 100,
      discoveryWeight: 10,
      availabilityMonth: 0,
      year: 1880,
    };
    expect(decodeOk(TechnologyPrerequisiteChainSchema, valid)).toBe(true);
  });

  it("rejects discovery weight outside 1..1_000_000", () => {
    const invalid = {
      id: "basic_gunnery",
      name: "Basic Gunnery",
      category: "weapons",
      researchFieldId: "GUNNERY",
      discoveryWeight: 0,
    };
    expect(decodeOk(TechnologyPrerequisiteChainSchema, invalid)).toBe(false);
  });
});

describe("CANONICAL_RESEARCH_FIELD_IDS", () => {
  it("contains exactly the 15 canonical fields in DESIGN-20 §1 order", () => {
    expect(CANONICAL_RESEARCH_FIELD_IDS).toEqual([
      "HULL_CONSTRUCTION",
      "MACHINERY",
      "SHIP_DESIGN",
      "GUNNERY",
      "FIRE_CONTROL",
      "TORPEDOES",
      "SUBMARINES",
      "MINES_AND_ASW",
      "AVIATION",
      "CARRIER_OPERATIONS",
      "RADAR_AND_ELECTRONICS",
      "MISSILES",
      "AMPHIBIOUS_OPERATIONS",
      "INFRASTRUCTURE",
      "DAMAGE_CONTROL",
    ]);
  });

  it("declares exact priority weights 4/2/1", () => {
    expect(RESEARCH_FIELD_PRIORITY_WEIGHTS).toEqual({ HIGH: 4, MEDIUM: 2, LOW: 1 });
  });
});
