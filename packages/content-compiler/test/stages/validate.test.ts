import { describe, expect, it } from "vite-plus/test";
import { ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ParseOutput } from "../../src/stages/parse.js";

function makeInput(overrides: Partial<ParseOutput> = {}): ParseOutput {
  return {
    manifest: { name: "test-pack", version: "0.1.0", type: "fixture", files: {} },
    collectionDocs: new Map<string, unknown[]>(),
    sourcePaths: new Map<string, string[]>(),
    objectDocs: new Map<string, unknown>(),
    objectSourcePaths: new Map<string, string>(),
    contentDir: ".",
    ...overrides,
  };
}

function collection(
  key: string,
  items: readonly unknown[],
  file = `${key}.json`,
): Pick<ParseOutput, "collectionDocs" | "sourcePaths"> {
  return {
    collectionDocs: new Map([[key, [...items]]]),
    sourcePaths: new Map([[key, items.map(() => file)]]),
  };
}

function tech(id: string, prerequisiteIds: readonly string[] = []): unknown {
  return {
    id,
    name: `Tech ${id}`,
    category: "hull",
    researchFieldId: "HULL_CONSTRUCTION",
    ...(prerequisiteIds.length > 0
      ? { prerequisites: prerequisiteIds.map((techId) => ({ techId })) }
      : {}),
  };
}

function shipType(id: string, requiresTech: string | null = null): unknown {
  return {
    id,
    name: `Ship type ${id}`,
    engineClass: "capital_combatant",
    displayCategory: "CAPITAL_SHIP",
    roles: ["BATTLE_LINE"],
    era: "PRE_WAR",
    availability: {
      fromEra: "PRE_WAR",
      requiresTech,
      requiresCapability: null,
      mechanicsImplemented: true,
    },
    classification: { precedence: 20, requires: [] },
    torpedoPolicy: "OPTIONAL",
    relativeCost: 5,
    relativeBuildTime: 5,
    auxiliary: false,
    requiredHullTrait: null,
    presentation: {
      description: "The battle-line capital ship of the period.",
      recommendedUse: "Anchor the battle line.",
      weaknesses: "Slow and expensive.",
      armourProfile: "Heavy belt",
      armamentProfile: "Heavy guns",
    },
    order: 10,
    provenance: {
      sourceStatus: "DERIVED",
      confidence: "HIGH",
      kind: "game_conversion",
      sources: [],
    },
  };
}

function component(id: string, upgradePath: readonly string[] = []): unknown {
  return {
    id,
    displayName: id,
    category: "MATERIAL",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    requires: [],
    parameters: {},
    constants: {},
    weightKg: "1",
    volumeLitre: "1",
    costMicro: "1",
    crew: "0",
    powerKw: "0",
    upgradePath: [...upgradePath],
    tags: [],
  };
}

describe("ValidateStage", () => {
  it("returns undefined and reports MISSING-MANIFEST when there is no manifest", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput({ manifest: undefined }),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    expect(collector.hasErrors).toBe(true);
    expect(collector.errors.some((d) => d.code === "MISSING-MANIFEST")).toBe(true);
  });

  it("validates a well-formed pack and returns the validated collections (positive control)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(collection("technologies", [tech("tech_a"), tech("tech_b", ["tech_a"])])),
      new AbortController().signal,
      collector,
    );

    expect(collector.hasErrors).toBe(false);
    expect(result).toBeDefined();
    expect(result!.technologies).toHaveLength(2);
    expect(result!.manifest).toEqual({
      name: "test-pack",
      version: "0.1.0",
      type: "fixture",
      files: {},
    });
  });

  it("returns undefined when a collection item fails its schema", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(collection("countries", [{ id: "uk" }])),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
  });

  it("detects a duplicate id in a collection (DUP-ID)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(collection("technologies", [tech("tech_a"), tech("tech_a")])),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const dup = collector.errors.find((d) => d.code === "DUP-ID");
    expect(dup).toBeDefined();
    expect(dup!.entityId).toBe("tech_a");
  });

  it("rejects a technology that lists itself as a prerequisite (SELF_REFERENCE)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(collection("technologies", [tech("tech_a", ["tech_a"])], "techs.json")),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const selfRef = collector.errors.find((d) => d.code === "SELF_REFERENCE");
    expect(selfRef).toBeDefined();
    expect(selfRef!.entityId).toBe("tech_a");
    expect(selfRef!.sourceLocation?.path).toBe("techs.json");
  });

  it("detects a prerequisite cycle and names its members (TECHNOLOGY_PREREQUISITE_CYCLE)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(
        collection(
          "technologies",
          [tech("tech_a", ["tech_b"]), tech("tech_b", ["tech_a"])],
          "techs.json",
        ),
      ),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const cycle = collector.errors.find((d) => d.code === "TECHNOLOGY_PREREQUISITE_CYCLE");
    expect(cycle).toBeDefined();
    expect(cycle!.message).toContain("tech_a");
    expect(cycle!.message).toContain("tech_b");
    expect(cycle!.sourceLocation?.path).toBe("techs.json");
    expect((cycle!.relatedLocations ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("detects a ship-component upgrade cycle (COMPONENT_UPGRADE_CYCLE)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(
        collection(
          "shipComponents",
          [component("comp_a", ["comp_b"]), component("comp_b", ["comp_a"])],
          "ship-building/components.json",
        ),
      ),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const cycle = collector.errors.find((d) => d.code === "COMPONENT_UPGRADE_CYCLE");
    expect(cycle).toBeDefined();
    expect(cycle!.message).toContain("comp_a");
    expect(cycle!.message).toContain("comp_b");
  });

  it("reports a dangling cross-collection reference with a file + field path (REF)", () => {
    const collector = new DiagnosticCollector();
    const invalidComponent = { ...(component("comp_a") as Record<string, unknown>) };
    invalidComponent["requires"] = ["missing_tech"];
    const result = new ValidateStage().run(
      makeInput(collection("shipComponents", [invalidComponent], "ship-building/components.json")),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const ref = collector.errors.find(
      (d) => d.code === "REF" && d.message.includes("missing_tech"),
    );
    expect(ref).toBeDefined();
    expect(ref!.sourceLocation?.path).toBe("ship-building/components.json");
    expect(ref!.entityId).toBe("comp_a");
  });

  it("rejects a ship type whose requiresTech is not a known technology (SHIP_TYPE_UNKNOWN_TECHNOLOGY)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput({
        collectionDocs: new Map([
          ["technologies", [tech("tech_a")]],
          ["shipTypes", [shipType("BB", "missing_tech")]],
        ]),
        sourcePaths: new Map([
          ["technologies", ["techs.json"]],
          ["shipTypes", ["ship-building/ship-types.json"]],
        ]),
      }),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const unknown = collector.errors.find((d) => d.code === "SHIP_TYPE_UNKNOWN_TECHNOLOGY");
    expect(unknown).toBeDefined();
    expect(unknown!.message).toContain("missing_tech");
    expect(unknown!.entityId).toBe("BB");
    expect(unknown!.sourceLocation?.path).toBe("ship-building/ship-types.json");
  });

  it("accepts a ship type whose requiresTech names a known technology (positive control)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput({
        collectionDocs: new Map([
          ["technologies", [tech("tech_a")]],
          ["shipTypes", [shipType("BB", "tech_a"), shipType("CA")]],
        ]),
        sourcePaths: new Map([
          ["technologies", ["techs.json"]],
          ["shipTypes", ["ship-building/ship-types.json", "ship-building/ship-types.json"]],
        ]),
      }),
      new AbortController().signal,
      collector,
    );

    expect(collector.errors.some((d) => d.code === "SHIP_TYPE_UNKNOWN_TECHNOLOGY")).toBe(false);
    expect(collector.hasErrors).toBe(false);
    expect(result).toBeDefined();
    expect(result!.shipTypes).toHaveLength(2);
  });

  it("detects a duplicate ship type id (DUP-ID)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput({
        collectionDocs: new Map([["shipTypes", [shipType("BB"), shipType("BB")]]]),
        sourcePaths: new Map([
          ["shipTypes", ["ship-building/ship-types.json", "ship-building/ship-types.json"]],
        ]),
      }),
      new AbortController().signal,
      collector,
    );

    expect(result).toBeUndefined();
    const dup = collector.errors.find((d) => d.code === "DUP-ID" && d.message.includes("ShipType"));
    expect(dup).toBeDefined();
    expect(dup!.entityId).toBe("BB");
  });

  it("accepts an acyclic component upgrade chain (positive control)", () => {
    const collector = new DiagnosticCollector();
    const result = new ValidateStage().run(
      makeInput(
        collection("shipComponents", [component("comp_a", ["comp_b"]), component("comp_b")]),
      ),
      new AbortController().signal,
      collector,
    );

    expect(collector.hasErrors).toBe(false);
    expect(result).toBeDefined();
    expect(result!.shipComponents).toHaveLength(2);
  });
});
