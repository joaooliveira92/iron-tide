import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CompiledPartModelSchema,
  FlattenedPartSchema,
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
  const legacyIds = new Set(components.map((component) => component.id));

  it("equals the legacy data.components projection for every legacy id and field", () => {
    expect(
      buildPartCatalogueView(model)
        .filter((entry) => legacyIds.has(entry.id))
        .map(key),
    ).toEqual(legacyCatalogueView(components).map(key));
  });

  it("selects the legacy catalogue plus the authored radar and missile launcher parts", () => {
    const view = buildPartCatalogueView(model);
    expect(view).toHaveLength(components.length + 6);
    expect(view.filter((entry) => legacyIds.has(entry.id)).map((e) => e.id)).toEqual(
      legacyCatalogueView(components).map((e) => e.id),
    );
    expect(view.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "rad_type_286_search",
        "rad_type_284_fire_control",
        "mis_launcher_light_ssm",
        "mis_launcher_medium_ssm",
        "mis_launcher_heavy_ssm",
      ]),
    );
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

  it("lists the E-1 families in their designer categories", () => {
    const provenance = {
      sourceStatus: "VERIFIED",
      confidence: "HIGH",
      kind: "historical_fact",
      sources: [],
    } as const;
    const part = (id: string, family: string, provides: string, capabilities: unknown[]) =>
      decodeStrict(FlattenedPartSchema, {
        id,
        family,
        provides,
        name: id,
        lifecycle: { availableFrom: "1940-01" },
        spec: {},
        capabilities,
        quantities: [{ id: "mass", kind: "massKg", value: 100, basis: "PER_PART_UNIT" }],
        revisions: [],
        origin: { sourceFile: "ship-building/parts/sensor.yaml" },
        provenance,
      });
    const parts = [
      part("radar", "radar", "radar", [{ kind: "search_radar", level: 1 }]),
      part("sonar", "sonar", "sonar", [{ kind: "sonar_detection", level: 1 }]),
      part("asw", "asw_weapon", "asw_weapon", [{ kind: "asw_attack", level: 1 }]),
      part("aa", "aa_weapon", "aa_weapon", [{ kind: "aa_engagement", level: 1 }]),
      part("missile", "missile_launcher", "missile_launcher", [
        { kind: "missile_launch", missileClass: "heavy_ssm" },
      ]),
      part("hangar", "hangar", "hangar", [{ kind: "aircraft_hangar", capacity: 1 }]),
    ];
    const model = decodeStrict(CompiledPartModelSchema, {
      partIndex: {
        byId: Object.fromEntries(parts.map((p) => [p.id, p])),
        byInterface: {},
        byFamily: {},
        lineage: {},
        shipTypes: [],
      },
      slotTemplates: [],
      platforms: [],
    });
    expect(
      Object.fromEntries(buildPartCatalogueView(model).map((e) => [e.id, e.category])),
    ).toEqual({
      aa: "AA_WEAPON",
      asw: "ASW_WEAPON",
      hangar: "AIRCRAFT_FACILITY",
      missile: "MISSILE_LAUNCHER",
      radar: "RADAR",
      sonar: "SONAR",
    });
  });
});
