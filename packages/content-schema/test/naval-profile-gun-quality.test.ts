import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { NavalProfileCatalogueSchema } from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const root = join(process.cwd(), "..", "..", "content", "production", "1880");

type Profile = Record<string, unknown> & { nationId: string };
type Catalogue = { navalProfiles: Profile[] };

const load = (nation: string): Catalogue =>
  structuredClone(
    (
      createRequire(import.meta.url)(
        join(root, "ship-building/naval-profiles", `${nation}.ts`),
      ) as {
        default: unknown;
      }
    ).default,
  ) as Catalogue;

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "test",
};

const band = (id: string, min: number, max: number, quality: number) => ({
  id,
  minCaliberUm: min,
  maxCaliberUm: max,
  quality,
  provenance,
});

const withGunQuality = (gunQuality: unknown): Catalogue => {
  const data = load("uk");
  data.navalProfiles[0] = { ...data.navalProfiles[0]!, gunQuality };
  return data;
};

const validBands = [
  band("light", 1, 152_000, 0),
  band("medium", 152_000, 254_000, 1),
  band("heavy", 254_000, 1_000_000, -1),
];

describe("NationNavalProfile.gunQuality", () => {
  it("accepts a profile without gunQuality", () => {
    const data = load("uk");
    const { gunQuality: _omitted, ...rest } = data.navalProfiles[0] as Profile;
    data.navalProfiles[0] = rest as Profile;
    expect(
      decodeOk(NavalProfileCatalogueSchema, data),
      decodeIssue(NavalProfileCatalogueSchema, data),
    ).toBe(true);
  });

  it("accepts bounded bands with provenance", () => {
    const data = withGunQuality({ bands: validBands, provenance });
    expect(
      decodeOk(NavalProfileCatalogueSchema, data),
      decodeIssue(NavalProfileCatalogueSchema, data),
    ).toBe(true);
  });

  it.each([3, -4, 0.5, Number.NaN])(
    "rejects quality %s outside gun_quality_v1 levels",
    (quality) => {
      const data = withGunQuality({
        bands: [band("light", 1, 152_000, quality), ...validBands.slice(1)],
        provenance,
      });
      expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
    },
  );

  it.each([-3, 2])("accepts the inclusive bound %s", (quality) => {
    const data = withGunQuality({
      bands: [band("light", 1, 152_000, quality), ...validBands.slice(1)],
      provenance,
    });
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(true);
  });

  it("rejects a band without provenance", () => {
    const { provenance: _p, ...bare } = validBands[0]!;
    const data = withGunQuality({ bands: [bare, ...validBands.slice(1)], provenance });
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
  });

  it("rejects an unknown provenance kind", () => {
    const data = withGunQuality({
      bands: [
        { ...validBands[0]!, provenance: { ...provenance, kind: "guess" } },
        ...validBands.slice(1),
      ],
      provenance,
    });
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
  });

  it("rejects overlapping bands", () => {
    const data = withGunQuality({
      bands: [band("a", 1, 200_000, 0), band("b", 150_000, 300_000, 0)],
      provenance,
    });
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
  });

  it("rejects an empty or inverted band", () => {
    expect(decodeOk(NavalProfileCatalogueSchema, withGunQuality({ bands: [], provenance }))).toBe(
      false,
    );
    expect(
      decodeOk(
        NavalProfileCatalogueSchema,
        withGunQuality({ bands: [band("a", 200_000, 100_000, 0)], provenance }),
      ),
    ).toBe(false);
  });

  it("rejects an excess key on a band", () => {
    const data = withGunQuality({
      bands: [{ ...validBands[0]!, excess: 1 }, ...validBands.slice(1)],
      provenance,
    });
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
  });
});

describe("authored production profiles (wire parity)", () => {
  it.each(
    readdirSync(join(root, "ship-building/naval-profiles")).map((f) => f.replace(/\.ts$/, "")),
  )("%s still decodes unchanged under the optional gunQuality field", (nation) => {
    const data = load(nation);
    expect(
      decodeOk(NavalProfileCatalogueSchema, data),
      decodeIssue(NavalProfileCatalogueSchema, data),
    ).toBe(true);
  });
});
