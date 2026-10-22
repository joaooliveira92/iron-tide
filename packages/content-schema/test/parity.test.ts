import { describe, expect, it } from "vite-plus/test";
import { AreaSchema, DesignTemplateSchema, PortSchema, ShipComponentSchema } from "../src/index.js";
import { decodeOk } from "./decode-helpers.js";

const designBase = {
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

describe("unknown/excess key rejection parity", () => {
  it("rejects an unknown key at the top level (previously-open z.object is now fail-closed)", () => {
    expect(decodeOk(AreaSchema, { id: "lon", name: "London", type: "land", extra: 1 })).toBe(false);
  });

  it("rejects an unknown key nested inside an array element", () => {
    const mount = {
      mountType: "UNDERWATER_FIXED",
      tubeCount: 2,
      torpedoModelId: "whitehead_14in_1886",
      extra: 1,
    };
    expect(decodeOk(DesignTemplateSchema, { ...designBase, torpedoArmament: [mount] })).toBe(false);
  });

  it("still accepts the same shape without the excess key", () => {
    const mount = {
      mountType: "UNDERWATER_FIXED",
      tubeCount: 2,
      torpedoModelId: "whitehead_14in_1886",
    };
    expect(decodeOk(DesignTemplateSchema, { ...designBase, torpedoArmament: [mount] })).toBe(true);
  });

  it("does not over-reject record keys (arbitrary map keys are still allowed)", () => {
    const component = {
      id: "qf_47in",
      displayName: "4.7-inch QF",
      category: "SECONDARY_GUN",
      introduction: { fromMonth: "1887-01", obsoleteMonth: null },
      requires: [],
      parameters: { arbitrary_param: { min: 1, max: 2, step: 1 } },
      constants: { arbitraryConstantKey: 3 },
      weightKg: "1",
      volumeLitre: "10",
      costMicro: "1",
      crew: "1",
      powerKw: "0",
      upgradePath: [],
      tags: [],
    };
    expect(decodeOk(ShipComponentSchema, component)).toBe(true);
  });
});

describe("non-finite number rejection parity (Schema.Finite)", () => {
  const port = { id: "p", name: "P", areaId: "a", nationId: "uk" };

  it("rejects NaN, Infinity and -Infinity where Zod z.number() rejected them", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(decodeOk(PortSchema, { ...port, level: bad })).toBe(false);
    }
  });

  it("accepts a finite in-range level", () => {
    expect(decodeOk(PortSchema, { ...port, level: 3 })).toBe(true);
  });
});
