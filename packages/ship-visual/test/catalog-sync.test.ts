import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeStrict, parseYamlSafe, ShipVisualCatalogSchema } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MOUNT_CLASSES, PART_CATALOG, SIZE_BANDS } from "../src/index.js";

const YAML_PATH = resolve(import.meta.dirname, "../../../content/ship-visual/parts.yaml");

describe("the generated catalog", () => {
  it("is exactly the schema-decoded content YAML (regenerate with `catalog:generate`)", () => {
    const diagnostics = new DiagnosticCollector();
    const parsed = parseYamlSafe(readFileSync(YAML_PATH, "utf8"), YAML_PATH, diagnostics);
    expect(diagnostics.toHuman()).toBe("");
    const decoded = decodeStrict(ShipVisualCatalogSchema, parsed.data);
    expect(PART_CATALOG).toEqual(decoded);
  });

  it("has unique entry ids", () => {
    const ids = [...PART_CATALOG.mounts, ...PART_CATALOG.masts].map((p) => p.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("has unique keys, so resolution never depends on authoring order", () => {
    const keys = PART_CATALOG.mounts.flatMap((p) =>
      p.key.sizes.map((size) =>
        [p.key.style, p.key.era, size, p.key.mountClass, p.key.guns ?? "*"].join("/"),
      ),
    );
    expect(keys.length).toBe(new Set(keys).size);
    const mastKeys = PART_CATALOG.masts.map((p) => `${p.key.style}/${p.key.era}`);
    expect(mastKeys.length).toBe(new Set(mastKeys).size);
  });

  it("covers every size × class in the universal dreadnought default, count-agnostic", () => {
    const missing = SIZE_BANDS.flatMap((size) =>
      MOUNT_CLASSES.filter(
        (mountClass) =>
          !PART_CATALOG.mounts.some(
            (p) =>
              p.key.style === "X" &&
              p.key.era === "DREADNOUGHT" &&
              p.key.sizes.includes(size) &&
              p.key.mountClass === mountClass &&
              p.key.guns === undefined,
          ),
      ).map((mountClass) => `${size}/${mountClass}`),
    );
    expect(missing).toEqual([]);
  });

  it("has universal masts for the dreadnought default and both EARLY eras", () => {
    const universal = PART_CATALOG.masts.filter((m) => m.key.style === "X").map((m) => m.key.era);
    expect(universal).toEqual(
      expect.arrayContaining(["VICTORIAN", "PRE_DREADNOUGHT", "DREADNOUGHT"]),
    );
  });
});
