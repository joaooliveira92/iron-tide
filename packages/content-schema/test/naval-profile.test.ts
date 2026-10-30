import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { NavalProfileCatalogueSchema } from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const requireAuthored = (path: string): unknown =>
  structuredClone((createRequire(import.meta.url)(path) as { default: unknown }).default);

const root = join(process.cwd(), "..", "..", "content", "production", "1880");
type ProfileCatalogue = {
  navalProfiles: ({ hardCapabilities: Record<string, unknown> } & Record<string, unknown>)[];
};

const read = (): ProfileCatalogue =>
  requireAuthored(join(root, "ship-building/naval-profiles/uk.ts")) as ProfileCatalogue;

describe("NavalProfileCatalogueSchema — authored production catalogue", () => {
  it("decodes the whole catalogue under the strict excess-key policy (records and all)", () => {
    const data = read();
    expect(
      decodeOk(NavalProfileCatalogueSchema, data),
      decodeIssue(NavalProfileCatalogueSchema, data),
    ).toBe(true);
  });

  it("rejects an excess key on a nested profile", () => {
    const data = read();
    const first = data.navalProfiles[0];
    data.navalProfiles[0] = { ...first, excess: 1 };
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
  });

  it("accepts an optional imported gun ceiling on hardCapabilities", () => {
    const data = read();
    const first = data.navalProfiles[0];
    data.navalProfiles[0] = {
      ...first,
      hardCapabilities: { ...first.hardCapabilities, maxImportedGunCaliberUm: 381000 },
    };
    expect(
      decodeOk(NavalProfileCatalogueSchema, data),
      decodeIssue(NavalProfileCatalogueSchema, data),
    ).toBe(true);
  });

  it("rejects a non-positive imported gun ceiling", () => {
    const data = read();
    const first = data.navalProfiles[0];
    data.navalProfiles[0] = {
      ...first,
      hardCapabilities: { ...first.hardCapabilities, maxImportedGunCaliberUm: 0 },
    };
    expect(decodeOk(NavalProfileCatalogueSchema, data)).toBe(false);
  });
});
