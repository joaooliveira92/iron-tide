import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CompiledPartModelSchema,
  ShipComponentCatalogueSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  buildPartCatalogueView,
  legacyCatalogueView,
  type PartCatalogueEntry,
} from "../src/index.js";

const artifactPath = join(
  __dirname,
  "..",
  "..",
  "..",
  "content",
  "generated",
  "1880",
  "content-artifact.json",
);

const artifact: unknown = JSON.parse(readFileSync(artifactPath, "utf8"));
const shipBuilding = (artifact as { readonly shipBuilding: unknown }).shipBuilding;
const slice = (key: string): unknown => (shipBuilding as Readonly<Record<string, unknown>>)[key];
const model = decodeStrict(CompiledPartModelSchema, slice("partModel"));
const components = decodeStrict(ShipComponentCatalogueSchema, {
  components: slice("components"),
}).components;

const key = (e: PartCatalogueEntry) =>
  JSON.stringify({
    id: e.id,
    displayName: e.displayName,
    category: e.category,
    introduction: e.introduction,
    requires: e.requires,
    tags: e.tags,
    fcClass: e.fcClass,
    parameters: Object.fromEntries(
      Object.entries(e.parameters).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
    allowedZones: e.allowedZones ?? null,
    entryUnits: e.entryUnits,
    rounds: e.rounds,
  });

describe("family-level catalogue view (17b-1)", () => {
  it("equals the legacy data.components projection for every legacy id and field", () => {
    expect(buildPartCatalogueView(model).map(key)).toEqual(
      legacyCatalogueView(components).map(key),
    );
  });

  it("selects exactly the legacy family-level catalogue: 49 entries, one per component id", () => {
    const view = buildPartCatalogueView(model);
    expect(view).toHaveLength(components.length);
    expect(view).toHaveLength(49);
    expect(view.map((e) => e.id)).toEqual(legacyCatalogueView(components).map((e) => e.id));
  });

  it("excludes national gun models, prototypes and mounts (the menu does not grow)", () => {
    const ids = new Set(buildPartCatalogueView(model).map((e) => e.id));
    expect(ids.has("standard_gun_bl_12in_25")).toBe(false);
    expect(ids.has("uk_bl_12in_25_mk1")).toBe(false);
    expect(ids.has("gun_bl_12in_25_turret")).toBe(false);
    expect(ids.has("tube_14in_above_water")).toBe(true);
    expect(ids.has("uk_tube_14in_aw_mk4")).toBe(false);
  });

  it("is deterministic and id-ordered", () => {
    const first = buildPartCatalogueView(model).map((e) => e.id);
    const again = buildPartCatalogueView(model).map((e) => e.id);
    expect(again).toEqual(first);
    expect([...first].sort()).toEqual(first);
  });

  it("the parts-less fallback carries allowedZones and parameters unchanged (17b-2)", () => {
    const base = components[0]!;
    const withZones = { ...base, allowedZones: ["TURRET"] as const };
    const [entry] = legacyCatalogueView([withZones]);
    expect(entry!.allowedZones).toEqual(["TURRET"]);
    expect(entry!.parameters).toEqual(base.parameters);
  });
});
