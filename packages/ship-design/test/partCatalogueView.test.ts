/**
 * The family-level catalogue view (ship-part-model ticket 17b-1).
 *
 * The designer's read-only displays now read a projection of the compiled parts. This test is
 * the behaviour-preserving proof: for the shipped 1880 artifact, `buildPartCatalogueView` equals
 * the direct projection of the legacy `data.components` for every legacy id and every field the
 * view carries. It also pins the selection (45 family-level entries; national gun models and
 * launcher variants excluded) so the menu cannot grow.
 *
 * Expected values come from the legacy component records, not recomputed the way the view is.
 */
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

/** The artifact is an untrusted file read; split it and decode each slice strictly (never cast). */
const artifact: unknown = JSON.parse(readFileSync(artifactPath, "utf8"));
const shipBuilding = (artifact as { readonly shipBuilding: unknown }).shipBuilding;
const slice = (key: string): unknown => (shipBuilding as Readonly<Record<string, unknown>>)[key];
const model = decodeStrict(CompiledPartModelSchema, slice("partModel"));
const components = decodeStrict(ShipComponentCatalogueSchema, {
  components: slice("components"),
}).components;

/** The view's fields in a stable order, so a deep compare reads the whole entry. */
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

  it("selects exactly the legacy family-level catalogue: 45 entries, one per component id", () => {
    const view = buildPartCatalogueView(model);
    expect(view).toHaveLength(components.length);
    expect(view).toHaveLength(45);
    expect(view.map((e) => e.id)).toEqual(legacyCatalogueView(components).map((e) => e.id));
  });

  it("excludes national gun models, prototypes and mounts (the menu does not grow)", () => {
    const ids = new Set(buildPartCatalogueView(model).map((e) => e.id));
    // A first-class national model, a catalogue-only model and every mount part must be absent.
    expect(ids.has("standard_gun_bl_12in_25")).toBe(false);
    expect(ids.has("uk_bl_12in_25_mk1")).toBe(false);
    expect(ids.has("gun_bl_12in_25_turret")).toBe(false);
    // A launcher base is present; its national variants are not.
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
