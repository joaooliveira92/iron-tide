import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vite-plus/test";
import {
  AmmunitionCatalogueSchema,
  GunFamilyCatalogueSchema,
  GunModelCatalogueSchema,
  GunMountCatalogueSchema,
} from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const dir = join(
  process.cwd(),
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
  "armament",
);
const read = (file: string) => parse(readFileSync(join(dir, file), "utf8"));

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
};

describe("armament content schema — the authored catalogue parses", () => {
  it("parses every gun family", () => {
    const data = read("gun-families.yaml");
    expect(
      decodeOk(GunFamilyCatalogueSchema, data),
      decodeIssue(GunFamilyCatalogueSchema, data),
    ).toBe(true);
  });
  it("parses every national gun model", () => {
    const data = read("gun-models.yaml");
    expect(
      decodeOk(GunModelCatalogueSchema, data),
      decodeIssue(GunModelCatalogueSchema, data),
    ).toBe(true);
  });
  it("parses every gun mount", () => {
    const data = read("gun-mounts.yaml");
    expect(
      decodeOk(GunMountCatalogueSchema, data),
      decodeIssue(GunMountCatalogueSchema, data),
    ).toBe(true);
  });
  it("parses every ammunition pattern", () => {
    const data = read("ammunition.yaml");
    expect(
      decodeOk(AmmunitionCatalogueSchema, data),
      decodeIssue(AmmunitionCatalogueSchema, data),
    ).toBe(true);
  });
});

describe("armament content schema — explicit units only", () => {
  const family = {
    id: "gun_x",
    designation: "X",
    category: "MAIN_GUN",
    defaultMountType: "TURRET",
    provenance,
  };

  it("rejects an ambiguous unitless field such as 'weight'", () => {
    expect(decodeOk(GunFamilyCatalogueSchema, { gunFamilies: [{ ...family, weight: 1000 }] })).toBe(
      false,
    );
  });

  it("rejects an ambiguous 'speed' field on a model", () => {
    expect(
      decodeOk(GunModelCatalogueSchema, {
        gunModels: [
          {
            id: "uk_gun_x",
            familyId: "gun_x",
            nationId: "uk",
            designation: "X",
            speed: 12,
            supportedMountTypes: ["TURRET"],
            requiredTechnologyIds: [],
            provenance,
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects a non-canonical id and an unknown mount type", () => {
    expect(decodeOk(GunFamilyCatalogueSchema, { gunFamilies: [{ ...family, id: "Gun X" }] })).toBe(
      false,
    );
    expect(
      decodeOk(GunFamilyCatalogueSchema, {
        gunFamilies: [{ ...family, defaultMountType: "SPACE_TURRET" }],
      }),
    ).toBe(false);
  });

  it("rejects an out-of-range reliability and a missing required field", () => {
    const base = {
      id: "uk_gun_x",
      familyId: "gun_x",
      nationId: "uk",
      designation: "X",
      supportedMountTypes: ["TURRET"],
      requiredTechnologyIds: [],
      provenance,
    };
    expect(
      decodeOk(GunModelCatalogueSchema, { gunModels: [{ ...base, reliabilityBp: 20_000 }] }),
    ).toBe(false);
    const { requiredTechnologyIds: _drop, ...missing } = base;
    expect(decodeOk(GunModelCatalogueSchema, { gunModels: [missing] })).toBe(false);
  });
});
