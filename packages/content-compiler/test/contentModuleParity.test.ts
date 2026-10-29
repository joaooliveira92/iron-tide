import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { ShipComponentCatalogueSchema, decodeStrict } from "@bluewave/content-schema";

import { loadContentModule } from "../src/contentModule.js";

const contentDir = resolve(__dirname, "..", "..", "..", "content", "production", "1880");
const modulePath = join(contentDir, "ship-building", "components", "guns", "french.ts");

const load = () => {
  const loaded = loadContentModule(modulePath);
  if (!loaded.ok) throw new Error(loaded.message);
  return decodeStrict(ShipComponentCatalogueSchema, loaded.document);
};

describe("authored content module parity (ADR-0334 stage 1)", () => {
  it("renders the document the migrated YAML produced, byte for byte", () => {
    const expected = JSON.parse(
      readFileSync(join(__dirname, "fixtures", "french-1880-component.json"), "utf8"),
    );
    const [component] = load().components;
    expect(component).toEqual(expected);
  });

  it("decodes under the same strict schema as authored YAML", () => {
    const catalogue = load();
    expect(catalogue.components.map((c) => c.id)).toEqual(["gun_bl_274mm_m1875"]);
  });

  it("reports a module that cannot be loaded instead of throwing", () => {
    const loaded = loadContentModule(
      join(contentDir, "ship-building", "components", "guns", "missing.ts"),
    );
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.message).toContain("failed to load");
  });
});
