import { resolvePartRevision } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";

import {
  buildContentBundleArtifact,
  collectProvenanceLocations,
  verifyContentBundleArtifact,
  verifyContentLock,
  type CompilerInput,
} from "../src/index.js";
import { PROVENANCE, baseInput, compile, createFixture, type Fixture } from "./partModelFixture.js";

/**
 * The flatten stage and the part index at the content compile seam (ship-part-model
 * ticket 02, SPM-R10, SPM-R11, SPM-R14). Expected values are worked by hand from the
 * fixtures below, never recomputed the way the stage computes them.
 */

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test" }],
};

// The hand-worked fixture: a prototype in one file, a national variant in another

const PROTOTYPE_FILE = "ship-building/parts/torpedoes.yaml";
const VARIANT_FILE = "ship-building/parts/austria-hungary.yaml";

const PROTOTYPE = `parts:
  - id: whitehead_14in
    family: torpedo
    provides: torpedo
    name: "Whitehead 14-inch"
    lifecycle: { availableFrom: "1880-01" }
    spec:
      diameterUm: 356000
      massKg: 300
      warheadType: WET_GUNCOTTON
      warheadExplosiveMassKg: 12
      warheadExplosiveEquivalentMassKg: 12
      propulsionType: COMPRESSED_AIR
      speedSettings:
        - { settingId: "cruise", speedMilliKnots: 24000, rangeM: 550 }
      minimumArmingDistanceM: 25
      reliabilityBp: 88000
      guidanceCapability: none
      launchTypes: [ABOVE_WATER_TRAINABLE]
      technologyPrerequisiteIds: []
      tubeHitHazardPolicy: ORDINARY
    quantities:
      - { id: torpedo_mass, kind: massKg, value: 300, basis: PER_PART_UNIT }
      - { id: torpedo_cost, kind: costMicro, value: 50000000, basis: PER_PART_UNIT }
    revisions:
      - { from: "1884-01", spec: { warheadExplosiveMassKg: 26, warheadExplosiveEquivalentMassKg: 26 }, provenance: ${PROVENANCE} }
    provenance: ${PROVENANCE}
`;

// The variant's revisions are declared out of order; the prototype's 1884 revision is
// not inherited, so the variant's warhead stays 12 kg until its own 1885 re-rating.
const VARIANT = `parts:
  - id: whitehead_14in_fiume
    family: torpedo
    provides: torpedo
    name: "Fiume 14-inch"
    nation: austria_hungary
    extends: whitehead_14in
    lifecycle: { availableFrom: "1881-01" }
    spec: { massKg: 305 }
    quantities:
      - { id: torpedo_cost, kind: costMicro, value: 45000000, basis: PER_PART_UNIT }
    revisions:
      - { from: "1889-07", spec: { speedSettings: [{ settingId: "fast", speedMilliKnots: 26000, rangeM: 550 }, { settingId: "slow", speedMilliKnots: 22000, rangeM: 900 }] }, provenance: { sourceStatus: VERIFIED, confidence: MEDIUM, kind: historical_fact, sources: [{ title: "speeds" }] } }
      - { from: "1885-03", spec: { warheadExplosiveMassKg: 30, warheadExplosiveEquivalentMassKg: 30 }, provenance: { sourceStatus: VERIFIED, confidence: LOW, kind: historical_fact, sources: [{ title: "warhead" }] } }
    provenance: ${PROVENANCE}
`;

const TORPEDO_SPEC = {
  diameterUm: 356000,
  massKg: 300,
  warheadType: "WET_GUNCOTTON",
  warheadExplosiveMassKg: 12,
  warheadExplosiveEquivalentMassKg: 12,
  propulsionType: "COMPRESSED_AIR",
  speedSettings: [{ settingId: "cruise", speedMilliKnots: 24000, rangeM: 550 }],
  minimumArmingDistanceM: 25,
  reliabilityBp: 88000,
  guidanceCapability: "none",
  launchTypes: ["ABOVE_WATER_TRAINABLE"],
  technologyPrerequisiteIds: [],
  tubeHitHazardPolicy: "ORDINARY",
};

const torpedoSpec = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...TORPEDO_SPEC,
  ...over,
});

function handWorked(fixture: Fixture, extra: Partial<CompilerInput> = {}): CompilerInput {
  return baseInput(fixture, {
    partFiles: [fixture.write(PROTOTYPE_FILE, PROTOTYPE), fixture.write(VARIANT_FILE, VARIANT)],
    ...extra,
  });
}

function withFixture<T>(body: (fixture: Fixture) => T): T {
  const fixture = createFixture();
  try {
    return body(fixture);
  } finally {
    fixture.cleanup();
  }
}

describe("a prototype, a variant and two revisions flatten to hand-worked values", () => {
  it.each([
    ["1884-12", "base", torpedoSpec({ massKg: 305 })],
    [
      "1887-01",
      "1885-03",
      torpedoSpec({
        massKg: 305,
        warheadExplosiveMassKg: 30,
        warheadExplosiveEquivalentMassKg: 30,
      }),
    ],
    [
      "1890-01",
      "1889-07",
      torpedoSpec({
        massKg: 305,
        warheadExplosiveMassKg: 30,
        warheadExplosiveEquivalentMassKg: 30,
        speedSettings: [
          { settingId: "fast", speedMilliKnots: 26000, rangeM: 550 },
          { settingId: "slow", speedMilliKnots: 22000, rangeM: 900 },
        ],
      }),
    ],
  ])("at %s the variant resolves to revision %s", (month, revision, spec) => {
    withFixture((fixture) => {
      const { output, collector } = compile(handWorked(fixture));
      expect(collector.errors).toEqual([]);
      const part = output?.bundle.shipBuilding?.partModel?.partIndex.byId["whitehead_14in_fiume"];
      expect(part).toBeDefined();
      const resolved = resolvePartRevision(part!, month);
      expect(resolved.revision).toBe(revision);
      expect(resolved.spec).toEqual(spec);
    });
  });

  it("the flattened variant has no extends, merged quantities and sorted revisions", () => {
    withFixture((fixture) => {
      const { output } = compile(handWorked(fixture));
      const part = output?.bundle.shipBuilding?.partModel?.partIndex.byId["whitehead_14in_fiume"];
      expect(part).not.toHaveProperty("extends");
      expect(part?.quantities).toEqual([
        { id: "torpedo_mass", kind: "massKg", value: 300, basis: "PER_PART_UNIT" },
        { id: "torpedo_cost", kind: "costMicro", value: 45000000, basis: "PER_PART_UNIT" },
      ]);
      expect(part?.revisions.map((r) => r.from)).toEqual(["1885-03", "1889-07"]);
      // Each revision keeps its own provenance through flattening.
      expect(part?.revisions.map((r) => r.provenance.confidence)).toEqual(["LOW", "MEDIUM"]);
      expect(part?.lifecycle).toEqual({ availableFrom: "1881-01" });
      expect(part?.nation).toBe("austria_hungary");
    });
  });

  it("every flattened part records where its values came from", () => {
    withFixture((fixture) => {
      const { output } = compile(handWorked(fixture));
      const byId = output?.bundle.shipBuilding?.partModel?.partIndex.byId;
      expect(byId?.["whitehead_14in"]?.origin).toEqual({
        sourceFile: PROTOTYPE_FILE,
      });
      expect(byId?.["whitehead_14in_fiume"]?.origin).toEqual({
        sourceFile: VARIANT_FILE,
        prototype: {
          id: "whitehead_14in",
          sourceFile: PROTOTYPE_FILE,
          inheritedSpec: [
            "diameterUm",
            "guidanceCapability",
            "launchTypes",
            "minimumArmingDistanceM",
            "propulsionType",
            "reliabilityBp",
            "speedSettings",
            "technologyPrerequisiteIds",
            "tubeHitHazardPolicy",
            "warheadExplosiveEquivalentMassKg",
            "warheadExplosiveMassKg",
            "warheadType",
          ],
          inheritedQuantities: ["torpedo_mass"],
        },
      });
    });
  });

  it("the index holds parts by id, interface and family, and the lineage graph", () => {
    withFixture((fixture) => {
      const successor = `parts:
  - id: whitehead_18in
    family: torpedo
    provides: torpedo
    name: "Whitehead 18-inch"
    lifecycle: { availableFrom: "1890-01", supersedes: [whitehead_14in_fiume, whitehead_14in] }
    spec:
      diameterUm: 457000
      massKg: 560
      warheadType: WET_GUNCOTTON
      warheadExplosiveMassKg: 90
      warheadExplosiveEquivalentMassKg: 90
      propulsionType: COMPRESSED_AIR
      speedSettings:
        - { settingId: "cruise", speedMilliKnots: 29000, rangeM: 730 }
      minimumArmingDistanceM: 25
      reliabilityBp: 90000
      guidanceCapability: none
      launchTypes: [ABOVE_WATER_TRAINABLE]
      technologyPrerequisiteIds: []
      tubeHitHazardPolicy: ORDINARY
    provenance: ${PROVENANCE}
  - id: dry_funnel
    family: fitting
    provides: funnel
    name: "Funnel"
    lifecycle: { availableFrom: "1880-01" }
    spec: {}
    provenance: ${PROVENANCE}
`;
      const { output, collector } = compile(
        handWorked(fixture, {
          partFiles: [
            fixture.write("ship-building/parts/later.yaml", successor),
            fixture.write(VARIANT_FILE, VARIANT),
            fixture.write(PROTOTYPE_FILE, PROTOTYPE),
          ],
        }),
      );
      expect(collector.errors).toEqual([]);
      const index = output?.bundle.shipBuilding?.partModel?.partIndex;
      expect(Object.keys(index?.byId ?? {})).toEqual([
        "dry_funnel",
        "whitehead_14in",
        "whitehead_14in_fiume",
        "whitehead_18in",
      ]);
      expect(index?.byInterface).toEqual({
        funnel: ["dry_funnel"],
        torpedo: ["whitehead_14in", "whitehead_14in_fiume", "whitehead_18in"],
      });
      expect(index?.byFamily).toEqual({
        fitting: ["dry_funnel"],
        torpedo: ["whitehead_14in", "whitehead_14in_fiume", "whitehead_18in"],
      });
      expect(index?.lineage).toEqual({
        dry_funnel: { variants: [], supersedes: [], supersededBy: [] },
        whitehead_14in: {
          variants: ["whitehead_14in_fiume"],
          supersedes: [],
          supersededBy: ["whitehead_18in"],
        },
        whitehead_14in_fiume: {
          prototype: "whitehead_14in",
          variants: [],
          supersedes: [],
          supersededBy: ["whitehead_18in"],
        },
        whitehead_18in: {
          variants: [],
          supersedes: ["whitehead_14in", "whitehead_14in_fiume"],
          supersededBy: [],
        },
      });
    });
  });
});

// The ship-type registry beside the part index (ticket 12a)

/** A minimal valid ship-type record, as a JSON record. */
function shipType(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name: id,
    engineClass: "capital_combatant",
    displayCategory: "CAPITAL_SHIP",
    roles: ["BATTLE_LINE"],
    era: "EARLY",
    availability: {
      fromEra: "EARLY",
      requiresTech: null,
      requiresCapability: null,
      mechanicsImplemented: true,
    },
    classification: { precedence: 20, requires: [] },
    torpedoPolicy: "OPTIONAL",
    relativeCost: 3,
    relativeBuildTime: 3,
    auxiliary: false,
    requiredHullTrait: null,
    presentation: {
      description: "d",
      recommendedUse: "r",
      weaknesses: "w",
      armourProfile: "a",
      armamentProfile: "m",
    },
    order: 10,
    provenance,
    ...overrides,
  };
}

describe("the ship-type registry rides beside the part index, id-sorted", () => {
  it("populates PartIndex.shipTypes in codepoint id order regardless of declaration order", () => {
    withFixture((fixture) => {
      const first = compile(
        baseInput(fixture, {
          shipTypeFiles: [
            fixture.write(
              "ship-building/ship-types.yaml",
              JSON.stringify({ shipTypes: [shipType("KE"), shipType("AMC"), shipType("B")] }),
            ),
          ],
        }),
      );
      expect(first.collector.errors).toEqual([]);
      const index = first.output?.bundle.shipBuilding?.partModel?.partIndex;
      expect(index?.shipTypes.map((record) => record.id)).toEqual(["AMC", "B", "KE"]);
      expect(index?.shipTypes.map((record) => record.name)).toEqual(["AMC", "B", "KE"]);

      // A different declaration order flattens to the same id-sorted array.
      const second = compile(
        baseInput(fixture, {
          shipTypeFiles: [
            fixture.write(
              "ship-building/other-types.yaml",
              JSON.stringify({ shipTypes: [shipType("B"), shipType("KE"), shipType("AMC")] }),
            ),
          ],
        }),
      );
      expect(second.collector.errors).toEqual([]);
      expect(second.output?.bundle.shipBuilding?.partModel?.partIndex.shipTypes).toEqual(
        index?.shipTypes,
      );
    });
  });

  it("ascribes an unknown engine class to the strict decoder with the source file", () => {
    withFixture((fixture) => {
      const file = fixture.write(
        "ship-building/ship-types.yaml",
        JSON.stringify({ shipTypes: [shipType("B", { engineClass: "carrier_group" })] }),
      );
      const { output, collector } = compile(baseInput(fixture, { shipTypeFiles: [file] }));
      expect(output).toBeUndefined();
      const error = collector.errors.find((e) => e.code === "SCHEMA");
      expect(error?.message).toContain("ShipType");
      expect(error?.sourceLocation?.path).toBe(file);
    });
  });
});

// Structured diagnostics

/** A standalone part of `family`, as a JSON record. */
function part(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    family: "torpedo",
    provides: "torpedo",
    name: id,
    lifecycle: { availableFrom: "1880-01" },
    spec: { ...TORPEDO_SPEC },
    quantities: [{ id: "torpedo_mass", kind: "massKg", value: 300, basis: "PER_PART_UNIT" }],
    provenance,
    ...overrides,
  };
}

/** A variant of `prototype` with an empty delta. */
function variant(id: string, prototype: string, overrides: Record<string, unknown> = {}) {
  return part(id, { extends: prototype, spec: {}, quantities: undefined, ...overrides });
}

const GUN = {
  id: "bl_12in",
  family: "gun",
  provides: "gun",
  name: "BL 12-inch",
  lifecycle: { availableFrom: "1880-01" },
  spec: { calibreUm: 305000 },
  provenance,
};

const FUNNEL = {
  id: "funnel",
  family: "fitting",
  provides: "funnel",
  name: "Funnel",
  lifecycle: { availableFrom: "1880-01" },
  spec: {},
  provenance,
};

const CASE_FILE = "ship-building/parts/case.yaml";

describe("the flatten stage fails with a structured diagnostic", () => {
  it.each([
    [
      "a depth-2 extends",
      [part("a"), variant("b", "a"), variant("c", "b")],
      "PART_EXTENDS_DEPTH",
      "Part 'c'.extends:",
    ],
    [
      "a cross-family extends",
      [GUN, variant("t", "bl_12in")],
      "PART_EXTENDS_FAMILY",
      "Part 't'.family:",
    ],
    [
      "an extends cycle",
      [variant("x", "y"), variant("y", "x")],
      "PART_EXTENDS_CYCLE",
      "Part 'x'.extends: prototype cycle: x -> y -> x",
    ],
    ["a part extending itself", [variant("x", "x")], "PART_EXTENDS_CYCLE", "Part 'x'.extends:"],
    [
      "a variant that changes the interface",
      [FUNNEL, { ...FUNNEL, id: "magazine", provides: "magazine", extends: "funnel" }],
      "PART_VARIANT_INTERFACE",
      "Part 'magazine'.provides:",
    ],
    [
      "a variant that changes a quantity's basis",
      [
        part("a"),
        variant("b", "a", {
          quantities: [
            { id: "torpedo_mass", kind: "massKg", value: 1, basis: "PER_LOADOUT_ENTRY" },
          ],
        }),
      ],
      "PART_VARIANT_BASIS",
      "Part 'b'.quantities.0.basis:",
    ],
    [
      "a variant that changes a quantity's kind",
      [
        part("a"),
        variant("b", "a", {
          quantities: [{ id: "torpedo_mass", kind: "costMicro", value: 1, basis: "PER_PART_UNIT" }],
        }),
      ],
      "PART_VARIANT_KIND",
      "Part 'b'.quantities.0.kind:",
    ],
    [
      "a variant that adds a quantity component",
      [
        part("a"),
        variant("b", "a", {
          quantities: [{ id: "crew", kind: "crew", value: 2, basis: "PER_PART_UNIT" }],
        }),
      ],
      "PART_VARIANT_QUANTITY",
      "Part 'b'.quantities.0.id:",
    ],
    [
      "a variant that redefines its slots",
      [part("a"), variant("b", "a", { slots: [{ id: "x", accepts: ["torpedo"] }] })],
      "PART_VARIANT_FIELD",
      "Part 'b'.slots:",
    ],
    [
      "a variant that redefines its visual block",
      [part("a"), variant("b", "a", { visual: { override: "fiume_tube" } })],
      "PART_VARIANT_FIELD",
      "Part 'b'.visual:",
    ],
    [
      "a duplicate revision from",
      [
        part("a", {
          revisions: [
            { from: "1884-01", spec: { warheadExplosiveMassKg: 26 }, provenance },
            { from: "1884-01", spec: { warheadExplosiveMassKg: 27 }, provenance },
          ],
        }),
      ],
      "PART_REVISION_DUPLICATE",
      "Part 'a'.revisions.1.from:",
    ],
    [
      "a supersession cycle",
      [
        part("a", { lifecycle: { availableFrom: "1880-01", supersedes: ["b"] } }),
        part("b", { lifecycle: { availableFrom: "1880-01", supersedes: ["a"] } }),
      ],
      "PART_SUPERSEDES_CYCLE",
      "Part 'a'.lifecycle.supersedes: supersession cycle: a -> b -> a",
    ],
    [
      "a part superseding itself",
      [part("a", { lifecycle: { availableFrom: "1880-01", supersedes: ["a"] } })],
      "PART_SUPERSEDES_CYCLE",
      "Part 'a'.lifecycle.supersedes:",
    ],
  ])("%s", (_case, parts, code, message) => {
    withFixture((fixture) => {
      const file = fixture.write(CASE_FILE, JSON.stringify({ parts }));
      const { output, collector } = compile(baseInput(fixture, { partFiles: [file] }));
      expect(output).toBeUndefined();
      const error = collector.errors.find((e) => e.code === code);
      expect(error, collector.errors.map((e) => `${e.code} ${e.message}`).join("\n")).toBeDefined();
      expect(error?.stage).toBe("flatten");
      expect(error?.sourceLocation?.path).toBe(file);
      expect(error?.message).toContain(message);
    });
  });
});

describe("cross-references fail with the file and field path", () => {
  const SLOT_TEMPLATES = `slotTemplates:
  - id: capital_ship_1880s
    slots: [{ id: fwd_main, accepts: [gun_mount] }]
`;

  it.each([
    [
      "an unknown slot template",
      "slotTemplates: [capital_ship_1880s, cruiser_1880s]",
      "battleship_1880",
      "Platform 'form'.slotTemplates.1: unknown slot template 'cruiser_1880s'",
    ],
    [
      "an unknown hull form",
      "slotTemplates: [capital_ship_1880s]",
      "monitor_1880",
      "Platform 'form'.hullForm: unknown hull form 'monitor_1880'",
    ],
  ])("a platform naming %s", (_case, templates, hullForm, message) => {
    withFixture((fixture) => {
      const file = fixture.write(
        "ship-building/platforms.yaml",
        `platforms:\n  - { id: form, hullForm: ${hullForm}, ${templates} }\n`,
      );
      const { output, collector } = compile(
        baseInput(fixture, {
          slotTemplateFiles: [fixture.write("ship-building/slot-templates.yaml", SLOT_TEMPLATES)],
          platformFiles: [file],
        }),
      );
      expect(output).toBeUndefined();
      const error = collector.errors.find((e) => e.message.includes(message));
      expect(error?.code).toBe("REF");
      expect(error?.sourceLocation?.path).toBe(file);
    });
  });

  it.each([
    ["an unknown extends", [variant("b", "nope")], "Part 'b'.extends: unknown part 'nope'"],
    [
      "an unknown supersedes",
      [part("a", { lifecycle: { availableFrom: "1880-01", supersedes: ["nope"] } })],
      "Part 'a'.lifecycle.supersedes.0: unknown part 'nope'",
    ],
    [
      "an unknown legacy-exception forPart",
      [
        // The counterpart torpedo part is declared, so the `forPart` reference is checked.
        part("torpedo_14in", {}),
        // A legacy exception is admissible on a launcher only (ADR-0154 §10).
        part("a", {
          family: "torpedo_launcher",
          provides: "torpedo_launcher",
          spec: { launchType: "ABOVE_WATER_TRAINABLE", boreDiameterUm: 380000 },
          quantities: [],
          legacyExceptions: [
            { code: "DQ-TORPEDO-001", waives: "diameterUmEqualsBore", forPart: "nope", note: "n" },
          ],
        }),
      ],
      "Part 'a'.legacyExceptions.0.forPart: unknown part 'nope'",
    ],
    [
      "an unknown technology",
      [part("a", { lifecycle: { availableFrom: "1880-01", requires: ["torp_nope"] } })],
      "Part 'a'.lifecycle.requires.0: unknown technology 'torp_nope'",
    ],
  ])("%s", (_case, parts, message) => {
    withFixture((fixture) => {
      const file = fixture.write(CASE_FILE, JSON.stringify({ parts }));
      const { output, collector } = compile(baseInput(fixture, { partFiles: [file] }));
      expect(output).toBeUndefined();
      const error = collector.errors.find((e) => e.message.includes(message));
      expect(error?.code, collector.errors.map((e) => e.message).join("\n")).toBe("REF");
      expect(error?.sourceLocation?.path).toBe(file);
    });
  });
});

// Determinism, hash and lock

function buildArtifact(input: CompilerInput) {
  const collector = new DiagnosticCollector();
  const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
  expect(collector.errors).toEqual([]);
  return artifact!;
}

describe("the part index is deterministic and covered by the hash and lock", () => {
  it("is byte-identical across runs and across declaration order", () => {
    const first = withFixture((fixture) => buildArtifact(handWorked(fixture)));
    const again = withFixture((fixture) => buildArtifact(handWorked(fixture)));
    const reordered = withFixture((fixture) =>
      buildArtifact(
        baseInput(fixture, {
          partFiles: [
            fixture.write(VARIANT_FILE, VARIANT),
            fixture.write(PROTOTYPE_FILE, PROTOTYPE),
          ],
        }),
      ),
    );
    // Source files are recorded relative to the content root, so even the fixture
    // directory, which differs per run, leaves no trace in the bytes.
    expect(again.artifactJson).toBe(first.artifactJson);
    expect(reordered.artifactJson).toBe(first.artifactJson);
  });

  it("the body hash and the lock cover the part index", () => {
    withFixture((fixture) => {
      const before = buildArtifact(handWorked(fixture));
      const lock = {
        contentVersion: before.contentVersion,
        bodyHash: before.envelope.bodyHash,
        algorithm: before.envelope.algorithm,
      };
      expect(verifyContentLock(before, lock)).toEqual({ ok: true });

      const rebuilt = buildArtifact(handWorked(fixture));
      const edited = buildArtifact(
        baseInput(fixture, {
          partFiles: [
            fixture.write(PROTOTYPE_FILE, PROTOTYPE),
            fixture.write(VARIANT_FILE, VARIANT.replace("massKg: 305", "massKg: 306")),
          ],
        }),
      );
      expect(rebuilt.envelope.bodyHash).toBe(before.envelope.bodyHash);
      expect(edited.envelope.bodyHash).not.toBe(before.envelope.bodyHash);
      expect(verifyContentLock(edited, lock)).toMatchObject({
        ok: false,
        code: "CONTENT_LOCK_HASH_MISMATCH",
      });
    });
  });

  it("the written artifact verifies and decodes its part model", () => {
    withFixture((fixture) => {
      const artifact = buildArtifact(handWorked(fixture));
      const verified = verifyContentBundleArtifact(
        JSON.parse(artifact.artifactJson),
        JSON.parse(artifact.manifestJson),
      );
      expect(verified.ok).toBe(true);
      if (!verified.ok) return;
      expect(verified.bundle.shipBuilding?.partModel).toEqual(
        JSON.parse(artifact.artifactJson).shipBuilding.partModel,
      );
    });
  });
});

describe("part provenance reaches the confidence report and the placeholder gate", () => {
  it("finds each part's and each revision's provenance in the compiled bundle", () => {
    withFixture((fixture) => {
      const { output } = compile(handWorked(fixture));
      const locations = collectProvenanceLocations(output!.bundle).filter(
        (location) => location.collection === "shipBuilding.partModel.parts",
      );
      expect(locations.map((l) => `${l.recordId} ${l.field} ${String(l.confidence)}`)).toEqual([
        "whitehead_14in provenance HIGH",
        "whitehead_14in revisions[0].provenance HIGH",
        "whitehead_14in_fiume provenance HIGH",
        "whitehead_14in_fiume revisions[0].provenance LOW",
        "whitehead_14in_fiume revisions[1].provenance MEDIUM",
      ]);
    });
  });
});
