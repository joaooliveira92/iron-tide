import { resolve } from "node:path";

import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";

import { buildFullSurfaceInput } from "../src/index.js";
import { PROVENANCE, baseInput, compile, createFixture } from "./partModelFixture.js";

/**
 * The ship part model at the content compile seam (ship-part-model ticket 01). Part,
 * slot-template and platform files are declared in the pack manifest, decoded strictly,
 * and duplicate-id checked. The flatten stage (ticket 02, `partIndex.test.ts`) carries
 * them into the bundle; a pack without them compiles to the same artifact as before.
 */

const GUN_PARTS = `parts:
  - id: bl_12in_25
    family: gun
    provides: gun
    name: "BL 12-inch"
    lifecycle: { availableFrom: "1885-01" }
    spec: { calibreUm: 305000 }
    quantities: [{ id: gun_mass, kind: massKg, value: 44500, basis: PER_PART_UNIT }]
    provenance: ${PROVENANCE}
  - id: bl_12in_barbette_twin
    family: gun_mount
    provides: gun_mount
    name: "12-inch twin barbette"
    lifecycle: { availableFrom: "1885-01" }
    spec: { mountType: BARBETTE, gunsPerMount: 2 }
    quantities:
      - { id: fixed_installation, kind: massKg, value: 20000, basis: PER_LOADOUT_ENTRY }
      - { id: per_gun_installation, kind: massKg, value: 30000, basis: PER_CONTAINED_UNIT }
    slots: [{ id: guns, accepts: [gun], sameParts: true }]
    provenance: ${PROVENANCE}
`;

const SLOT_TEMPLATES = `slotTemplates:
  - id: capital_ship_1880s
    slots:
      - { id: fwd_main, accepts: [gun_mount], mountCount: { min: 0, max: 3 }, side: CENTRE }
      - { id: secondary_port, accepts: [gun_mount], mountCount: { min: 0, max: 8 }, side: PORT }
      - { id: secondary_stbd, mirrors: secondary_port }
`;

const PLATFORMS = `platforms:
  - { id: pre_dreadnought_form, hullForm: battleship_1880, slotTemplates: [capital_ship_1880s] }
`;

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test" }],
};
const lifecycle = { availableFrom: "1880-01" };

/** One minimal part of every family, written as JSON (a YAML subset). */
const ONE_PER_FAMILY = JSON.stringify({
  parts: [
    {
      id: "g",
      family: "gun",
      provides: "gun",
      name: "G",
      lifecycle,
      spec: { calibreUm: 1 },
      provenance,
    },
    {
      id: "m",
      family: "gun_mount",
      provides: "gun_mount",
      name: "M",
      lifecycle,
      spec: { mountType: "CASEMATE", gunsPerMount: 1 },
      provenance,
    },
    {
      id: "a",
      family: "ammunition",
      provides: "ammunition",
      name: "A",
      lifecycle,
      spec: { shellType: "AP" },
      provenance,
    },
    {
      id: "l",
      family: "torpedo_launcher",
      provides: "torpedo_launcher",
      name: "L",
      lifecycle,
      spec: { launchType: "UNDERWATER_FIXED", boreDiameterUm: 356000 },
      provenance,
    },
    {
      id: "t",
      family: "torpedo",
      provides: "torpedo",
      name: "T",
      lifecycle,
      spec: {
        diameterUm: 356000,
        massKg: 300,
        warheadType: "WET_GUNCOTTON",
        warheadExplosiveMassKg: 12,
        warheadExplosiveEquivalentMassKg: 12,
        propulsionType: "COMPRESSED_AIR",
        speedSettings: [{ settingId: "s1", speedMilliKnots: 24000, rangeM: 550 }],
        minimumArmingDistanceM: 25,
        reliabilityBp: 88000,
        guidanceCapability: "none",
        launchTypes: ["ABOVE_WATER_TRAINABLE"],
        technologyPrerequisiteIds: [],
        tubeHitHazardPolicy: "ORDINARY",
      },
      provenance,
    },
    {
      id: "p",
      family: "propulsion_plant",
      provides: "propulsion_plant",
      name: "P",
      lifecycle,
      spec: {
        fuelType: "COAL",
        weightMilliKgPerKw: 1,
        volumeLitrePerKw: 1,
        sfcGramPerKwh: { points: [[1, 1]] },
        reliabilityBp: 9000,
      },
      provenance,
    },
    {
      id: "r",
      family: "armour_material",
      provides: "armour_material",
      name: "R",
      lifecycle,
      spec: { efficiencyBp: 10000 },
      provenance,
    },
    { id: "s", family: "sensor", provides: "sensor", name: "S", lifecycle, spec: {}, provenance },
    { id: "f", family: "fitting", provides: "funnel", name: "F", lifecycle, spec: {}, provenance },
  ],
});

describe("ship part collections at the content compile seam", () => {
  it("valid parts, slot templates and platforms compile without diagnostics", () => {
    const fixture = createFixture();
    try {
      const { output, collector } = compile(
        baseInput(fixture, {
          partFiles: [fixture.write("ship-building/parts/guns.yaml", GUN_PARTS)],
          slotTemplateFiles: [fixture.write("ship-building/slot-templates.yaml", SLOT_TEMPLATES)],
          platformFiles: [fixture.write("ship-building/platforms.yaml", PLATFORMS)],
        }),
      );
      expect(collector.errors).toEqual([]);
      expect(output).toBeDefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("one part of every family compiles", () => {
    const fixture = createFixture();
    try {
      const { output, collector } = compile(
        baseInput(fixture, {
          partFiles: [fixture.write("ship-building/parts/all.yaml", ONE_PER_FAMILY)],
        }),
      );
      expect(collector.errors).toEqual([]);
      expect(output).toBeDefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("a pack without part-model files carries no part model, as before ticket 02", () => {
    const withParts = createFixture();
    const withoutParts = createFixture();
    try {
      const a = compile(
        baseInput(withParts, {
          partFiles: [withParts.write("ship-building/parts/guns.yaml", GUN_PARTS)],
          slotTemplateFiles: [withParts.write("ship-building/slot-templates.yaml", SLOT_TEMPLATES)],
          platformFiles: [withParts.write("ship-building/platforms.yaml", PLATFORMS)],
        }),
      );
      const b = compile(baseInput(withoutParts));
      expect(a.output?.bundle.shipBuilding?.partModel).toBeDefined();
      expect(b.output?.bundle.shipBuilding).toBeDefined();
      expect(b.output?.bundle.shipBuilding).not.toHaveProperty("partModel");
      // The content-pack subset hash never covered the ship-building catalogue.
      expect(a.output!.rawHash).toBe(b.output!.rawHash);
    } finally {
      withParts.cleanup();
      withoutParts.cleanup();
    }
  });

  it.each([
    [
      "an unknown interface",
      GUN_PARTS.replace("provides: gun\n", "provides: gun_12in\n"),
      "Part.provides:",
    ],
    [
      "an unknown basis",
      GUN_PARTS.replace("basis: PER_PART_UNIT", "basis: PER_MOUNT"),
      "Part.quantities.0.basis:",
    ],
    [
      "a visual trait",
      GUN_PARTS.replace(
        "spec: { calibreUm: 305000 }",
        "spec: { calibreUm: 305000 }\n    visual: { traits: { enclosure: open } }",
      ),
      "Part.visual.traits.enclosure:",
    ],
  ])("%s fails with the part file and field path", (_case, yaml, path) => {
    const fixture = createFixture();
    try {
      const file = fixture.write("ship-building/parts/guns.yaml", yaml);
      const { output, collector } = compile(baseInput(fixture, { partFiles: [file] }));
      expect(output).toBeUndefined();
      const schemaErrors = collector.errors.filter((error) => error.code === "SCHEMA");
      expect(schemaErrors.length).toBeGreaterThan(0);
      expect(
        schemaErrors.every(
          (error) => error.sourceLocation?.path === "ship-building/parts/guns.yaml",
        ),
      ).toBe(true);
      expect(schemaErrors.map((error) => error.message).join("\n")).toContain(path);
    } finally {
      fixture.cleanup();
    }
  });

  it("a visual-trait contradiction fails the visual compile stage (V1–V9)", () => {
    const fixture = createFixture();
    try {
      const yaml = GUN_PARTS.replace(
        "spec: { mountType: BARBETTE, gunsPerMount: 2 }",
        'spec: { mountType: BARBETTE, gunsPerMount: 2 }\n    visual: { traits: { presentation_form: { value: casemate, reason: "as built" } } }',
      );
      const file = fixture.write("ship-building/parts/guns.yaml", yaml);
      const { output, collector } = compile(baseInput(fixture, { partFiles: [file] }));
      expect(output).toBeUndefined();
      const violation = collector.errors.find((error) => error.code === "VISUAL_TRAIT");
      expect(violation?.entityId).toBe("bl_12in_barbette_twin");
      expect(violation?.message).toMatch(/V3/);
    } finally {
      fixture.cleanup();
    }
  });

  it("an unknown slot-constraint key fails with the slot-template file and path", () => {
    const fixture = createFixture();
    try {
      const file = fixture.write(
        "ship-building/slot-templates.yaml",
        SLOT_TEMPLATES.replace(
          "side: CENTRE }",
          "side: CENTRE, constraints: { calibreMmMin: 200 } }",
        ),
      );
      const { output, collector } = compile(baseInput(fixture, { slotTemplateFiles: [file] }));
      expect(output).toBeUndefined();
      const error = collector.errors.find((e) => e.message.includes("constraints.calibreMmMin"));
      expect(error?.sourceLocation?.path).toBe("ship-building/slot-templates.yaml");
      expect(error?.message).toContain("SlotTemplate.slots.0.constraints.calibreMmMin:");
    } finally {
      fixture.cleanup();
    }
  });

  it("a part id duplicated across two part files is a DUP-ID error", () => {
    const fixture = createFixture();
    try {
      const { output, collector } = compile(
        baseInput(fixture, {
          partFiles: [
            fixture.write("ship-building/parts/guns.yaml", GUN_PARTS),
            fixture.write("ship-building/parts/more-guns.yaml", GUN_PARTS),
          ],
        }),
      );
      expect(output).toBeUndefined();
      const dup = collector.errors.find((error) => error.code === "DUP-ID");
      expect(dup?.entityId).toBe("bl_12in_25");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("the manifest is the authority for part-model files", () => {
  it.each([
    ["parts", "ship-building/parts/guns.yaml", GUN_PARTS],
    ["slotTemplates", "ship-building/slot-templates.yaml", SLOT_TEMPLATES],
    ["platforms", "ship-building/platforms.yaml", PLATFORMS],
  ])("an undeclared %s file present on disk fails closed", (key, rel, content) => {
    const fixture = createFixture();
    try {
      fixture.write(
        "pack.json",
        JSON.stringify({
          name: "p",
          version: "0.1.0",
          type: "fixture",
          files: {},
          shipBuilding: {},
        }),
      );
      fixture.write(rel, content);
      const collector = new DiagnosticCollector();
      buildFullSurfaceInput(resolve(fixture.path, "pack.json"), fixture.path, collector);
      expect(
        collector.errors.some((error) => error.message.includes(`pack.json shipBuilding.${key}`)),
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("declared part, slot-template and platform files flow into the compiler input", () => {
    const fixture = createFixture();
    try {
      fixture.write(
        "pack.json",
        JSON.stringify({
          name: "p",
          version: "0.1.0",
          type: "fixture",
          files: {},
          shipBuilding: {
            parts: ["ship-building/parts/guns.yaml"],
            slotTemplates: ["ship-building/slot-templates.yaml"],
            platforms: ["ship-building/platforms.yaml"],
          },
        }),
      );
      fixture.write("ship-building/parts/guns.yaml", GUN_PARTS);
      fixture.write("ship-building/slot-templates.yaml", SLOT_TEMPLATES);
      fixture.write("ship-building/platforms.yaml", PLATFORMS);
      const collector = new DiagnosticCollector();
      const input = buildFullSurfaceInput(
        resolve(fixture.path, "pack.json"),
        fixture.path,
        collector,
      );
      expect(collector.errors).toEqual([]);
      expect(input?.partFiles).toEqual([resolve(fixture.path, "ship-building/parts/guns.yaml")]);
      expect(input?.slotTemplateFiles).toHaveLength(1);
      expect(input?.platformFiles).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });
});
