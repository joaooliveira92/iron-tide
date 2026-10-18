import { describe, it, expect } from "vite-plus/test";
import { Compiler } from "../src/index.js";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = resolve(tmpdir(), `bw-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFixture(base: string, rel: string, content: string): string {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
  return full;
}

/** A strict-NationSchema-compliant nation as a single YAML list item. */
function nationYaml(
  id: string,
  tag: string,
  name: string,
  isPlayable = false,
  homeArea?: string,
): string {
  return `
- id: "${id}"
  tag: "${tag}"
  name: "${name}"
  displayNameKey: "nation.${id}"
  isPlayable: ${isPlayable}${homeArea === undefined ? "" : `\n  homeArea: "${homeArea}"`}
  slot: null
  presentation: { colorBg: "#C8102E", colorFg: "#FFFFFF" }
  identity:
    oneSentence: "x"
    fullIdentity: "x"
    strategicProblem: "x"
  regime:
    type: "monarchy"
    politicalSystem: "constitutional_monarchy"
    headOfState: "x"
    headOfGovernment: "x"
    leaderTitle: "x"
    navalPolicyActors: []
    governmentModifiers: []
    stabilityProfile: { level: "high", factors: [] }
    description: "x"
  strategicObjectives: { primary: "x", secondary: "x" }
  baseResources:
    gdpTier: "great_power"
    gdpDescription: "x"
    population: "x"
    industrialization: "industrial"
    industrializationDescription: "x"
  navalAppropriation: { budgetLevel: "moderate", justification: "x" }
  economy:
    description: "x"
    character: "x"
    strengths: []
    weaknesses: []
    industrialBase: "mature_global"
  navalInstitution:
    description: "x"
    character: []
    seniority: "senior_service"
  doctrine: { summary: "x", schools: [] }
  shipDesign: { summary: "x", principles: [], favoredTypes: [] }
  ai: { archetype: "status_quo_maritime_hegemon", behavior: [] }
  navalPurpose: "sustain_global_empire"
  coreAnxiety: "loss_of_sea_control_overstretch"
  gameplayFeel: "manage_supremacy"
  historicalAssumptions: []
`;
}

/** A strict-ShipComponentSchema-compliant component as one `components` array item. */
function componentYaml(id: string): string {
  return componentYamlWith(id, []);
}

/** A strict-ShipComponentSchema-compliant component with explicit upgrade edges. */
function componentYamlWith(id: string, upgradePath: readonly string[]): string {
  return `
  - id: "${id}"
    displayName: "${id}"
    category: "MATERIAL"
    introduction: { fromMonth: "1880-01", obsoleteMonth: null }
    requires: []
    parameters: {}
    constants: {}
    weightKg: "1"
    volumeLitre: "1"
    costMicro: "1"
    crew: "0"
    powerKw: "0"
    upgradePath: [${upgradePath.map((u) => `"${u}"`).join(", ")}]
    tags: []
`;
}

function shipBuildingInput(fixturePath: string): Record<string, string[]> {
  return {
    shipComponentFiles: [resolve(fixturePath, "ship-building/components.yaml")],
    shipBalanceFiles: [resolve(fixturePath, "ship-building/balance.yaml")],
  };
}

/** A strict-ReferenceDesignSchema-compliant design with the given dangling references. */
function referenceDesignYaml(id: string, hullFormId: string, plantId: string): string {
  return `
designs:
  - id: "${id}"
    name: "Reference ${id}"
    month: "1880-01"
    draft:
      nationId: "uk"
      requirement:
        category: "B"
        requiredSpeedMilliKnots: 15000
        cruiseSpeedMilliKnots: 8000
        requiredRangeNm: 3000
        designThreatId: "rml_10in"
        modernizationExpectation: "MINOR"
        crewQualityBp: 10000
        accommodationStandard: "STANDARD"
      hull:
        hullFormId: "${hullFormId}"
        lengthWl: 90000
        beam: 18000
        draught: 7000
        depthToMainDeck: 9000
        blockCoeffBp: 6000
        materialId: "iron"
        structuralSchemeId: "mixed"
        subdivisionGrade: 2
        targetDisplacementKg: 9000000
        limitDisplacementKg: null
        designMarginBp: 300
        growthReserveBp: 0
      machinery:
        plantId: "${plantId}"
        installedKw: 5000
        zoneId: "CENTRAL_MACHINERY"
        stationPermille: 400
        fuelCapacityKg: 500000
        fuelZoneId: "CENTRAL_MACHINERY"
        fuelStationPermille: 450
        foulingBp: 0
      armour:
        regions: []
        citadelLengthMm: 0
        torpedoWarheadKg: 20
        bunkerProtectionBp: 0
      placements: []
`;
}

describe("Compiler", () => {
  it("compiles the full ship-building surface into one bundled artifact", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.4.0", type: "production", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/components.yaml",
        `components:${componentYaml("comp_a")}${componentYaml("comp_b")}`,
      );
      writeFixture(fixture.path, "ship-building/balance.yaml", `ship:\n  dummy: 1\n`);

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          ...shipBuildingInput(fixture.path),
        },
        new AbortController().signal,
        collector,
      );

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();
      expect(output!.contentVersion).toBe("0.4.0");
      expect(output!.bundle.shipBuilding).toBeDefined();
      expect(output!.bundle.shipBuilding!.components).toHaveLength(2);
      expect(output!.bundle.shipBuilding!.balance).toEqual({ ship: { dummy: 1 } });
      expect(output!.bundle.generatedBy).toContain("content:build");
    } finally {
      fixture.cleanup();
    }
  });

  it("omits shipBuilding from the bundle for a content-pack-only input", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        new AbortController().signal,
        collector,
      );
      expect(output).toBeDefined();
      expect(output!.bundle.shipBuilding).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects duplicate ship-building ids with the source file", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/components.yaml",
        `components:${componentYaml("comp_a")}${componentYaml("comp_a")}`,
      );

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          shipComponentFiles: [resolve(fixture.path, "ship-building/components.yaml")],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const dup = collector.errors.find((d) => d.code === "DUP-ID");
      expect(dup).toBeDefined();
      expect(dup!.sourceLocation?.path).toBe("ship-building/components.yaml");
      expect(dup!.entityId).toBe("comp_a");
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects a dangling cross-file ship-building reference with file + field path", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/reference-designs/uk/starters.yaml",
        referenceDesignYaml("rd_1", "missing_form", "missing_plant"),
      );

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          referenceDesignFiles: [
            resolve(fixture.path, "ship-building/reference-designs/uk/starters.yaml"),
          ],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const refs = collector.errors.filter((d) => d.code === "REF");
      expect(refs.some((d) => d.message.includes("missing_form"))).toBe(true);
      expect(refs.some((d) => d.message.includes("missing_plant"))).toBe(true);
      expect(
        refs.every(
          (d) => d.sourceLocation?.path === "ship-building/reference-designs/uk/starters.yaml",
        ),
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("compiles a valid content pack", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: {
            countries: ["countries.yaml"],
            areas: ["areas.yaml"],
            rulesets: ["rulesets.yaml"],
          },
        }),
      );

      writeFixture(
        fixture.path,
        "countries.yaml",
        nationYaml("uk", "GBR", "United Kingdom", true, "lon"),
      );

      writeFixture(
        fixture.path,
        "areas.yaml",
        `
- id: "lon"
  name: "London"
  type: "land"
  controller: "uk"
      `,
      );

      writeFixture(
        fixture.path,
        "rulesets.yaml",
        `
- id: "core"
  name: "Core Rules"
  version: "1.0"
      `,
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [resolve(fixture.path, "rulesets.yaml")],
          countryFiles: [resolve(fixture.path, "countries.yaml")],
          areaFiles: [resolve(fixture.path, "areas.yaml")],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        signal,
        collector,
      );

      expect(output).toBeDefined();
      expect(output!.pack.nations).toHaveLength(1);
      expect(output!.pack.nations[0]?.id).toBe("uk");
      expect(output!.rawHash).toHaveLength(64);
      expect(output!.envelopeHash).toHaveLength(64);
      expect(collector.hasErrors).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("detects duplicate IDs", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { countries: ["countries.yaml"] },
        }),
      );

      writeFixture(
        fixture.path,
        "countries.yaml",
        `${nationYaml("uk", "GBR", "United Kingdom")}${nationYaml("uk", "GBR", "United Kingdom")}`,
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.yaml")],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        signal,
        collector,
      );

      expect(output).toBeUndefined();
      expect(collector.hasErrors).toBe(true);
      expect(collector.errors.some((d) => d.code === "DUP-ID")).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("detects missing references", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: {
            possessions: ["possessions.yaml"],
            countries: ["countries.yaml"],
            areas: ["areas.yaml"],
          },
        }),
      );

      writeFixture(fixture.path, "countries.yaml", nationYaml("uk", "GBR", "United Kingdom"));
      writeFixture(fixture.path, "areas.yaml", `- id: "lon"\n  name: "London"\n  type: "land"\n`);
      writeFixture(
        fixture.path,
        "possessions.yaml",
        `- id: "uk-lon"\n  nationId: "uk"\n  areaId: "nonexistent"\n`,
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.yaml")],
          areaFiles: [resolve(fixture.path, "areas.yaml")],
          routeFiles: [],
          possessionFiles: [resolve(fixture.path, "possessions.yaml")],
          portFiles: [],
          technologyFiles: [],
        },
        signal,
        collector,
      );

      expect(output).toBeUndefined();
      expect(collector.hasErrors).toBe(true);
      expect(collector.errors.some((d) => d.code === "REF")).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("produces deterministic output on repeated compilation", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { countries: ["countries.yaml"] },
        }),
      );

      writeFixture(fixture.path, "countries.yaml", nationYaml("uk", "GBR", "United Kingdom"));

      const compiler = new Compiler();
      const signal = new AbortController().signal;

      const collector1 = new DiagnosticCollector();
      const output1 = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.yaml")],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        signal,
        collector1,
      );

      const collector2 = new DiagnosticCollector();
      const output2 = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.yaml")],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        signal,
        collector2,
      );

      expect(output1).toBeDefined();
      expect(output2).toBeDefined();
      expect(output1!.rawHash).toBe(output2!.rawHash);
      expect(output1!.envelopeHash).toBe(output2!.envelopeHash);
    } finally {
      fixture.cleanup();
    }
  });

  it("supports cancellation via AbortSignal", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { countries: ["countries.yaml"] },
        }),
      );

      writeFixture(fixture.path, "countries.yaml", nationYaml("uk", "GBR", "United Kingdom"));

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const controller = new AbortController();
      controller.abort();

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.yaml")],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        controller.signal,
        collector,
      );

      expect(output).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("detects technology prerequisite cycle with TECHNOLOGY_PREREQUISITE_CYCLE", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { technologies: ["technologies.yaml"] },
        }),
      );

      writeFixture(
        fixture.path,
        "technologies.yaml",
        `
- id: "tech_a"
  name: "Tech A"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
- id: "tech_b"
  name: "Tech B"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
  prerequisites:
    - { techId: "tech_c" }
- id: "tech_c"
  name: "Tech C"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
  prerequisites:
    - { techId: "tech_b" }
      `,
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [resolve(fixture.path, "technologies.yaml")],
        },
        signal,
        collector,
      );

      expect(output).toBeUndefined();
      expect(collector.hasErrors).toBe(true);
      expect(collector.errors.some((d) => d.code === "TECHNOLOGY_PREREQUISITE_CYCLE")).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("names the cycle members and their source files in the technology-cycle diagnostic", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { technologies: ["technologies.yaml"] },
        }),
      );
      writeFixture(
        fixture.path,
        "technologies.yaml",
        `
- id: "tech_a"
  name: "Tech A"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
  prerequisites:
    - { techId: "tech_b" }
- id: "tech_b"
  name: "Tech B"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
  prerequisites:
    - { techId: "tech_a" }
      `,
      );

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [resolve(fixture.path, "technologies.yaml")],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const cycle = collector.errors.find((d) => d.code === "TECHNOLOGY_PREREQUISITE_CYCLE");
      expect(cycle).toBeDefined();
      expect(cycle!.message).toContain("tech_a");
      expect(cycle!.message).toContain("tech_b");
      expect(cycle!.sourceLocation?.path).toBe("technologies.yaml");
      expect((cycle!.relatedLocations ?? []).length).toBeGreaterThanOrEqual(2);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects a technology that lists itself as a prerequisite (SELF_REFERENCE)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { technologies: ["technologies.yaml"] },
        }),
      );
      writeFixture(
        fixture.path,
        "technologies.yaml",
        `
- id: "tech_a"
  name: "Tech A"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
  prerequisites:
    - { techId: "tech_a" }
      `,
      );

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [resolve(fixture.path, "technologies.yaml")],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const selfRef = collector.errors.find((d) => d.code === "SELF_REFERENCE");
      expect(selfRef).toBeDefined();
      expect(selfRef!.entityId).toBe("tech_a");
      expect(selfRef!.sourceLocation?.path).toBe("technologies.yaml");
    } finally {
      fixture.cleanup();
    }
  });

  it("accepts an acyclic technology prerequisite chain (positive control)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: { technologies: ["technologies.yaml"] },
        }),
      );
      writeFixture(
        fixture.path,
        "technologies.yaml",
        `
- id: "tech_a"
  name: "Tech A"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
- id: "tech_b"
  name: "Tech B"
  category: "hull"
  researchFieldId: "HULL_CONSTRUCTION"
  prerequisites:
    - { techId: "tech_a" }
      `,
      );

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [resolve(fixture.path, "technologies.yaml")],
        },
        new AbortController().signal,
        collector,
      );

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects a ship component that upgrades from itself (SELF_REFERENCE)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/components.yaml",
        `components:${componentYamlWith("comp_a", ["comp_a"])}`,
      );
      writeFixture(fixture.path, "ship-building/balance.yaml", `ship:\n  dummy: 1\n`);

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          ...shipBuildingInput(fixture.path),
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const selfRef = collector.errors.find((d) => d.code === "SELF_REFERENCE");
      expect(selfRef).toBeDefined();
      expect(selfRef!.entityId).toBe("comp_a");
      expect(selfRef!.sourceLocation?.path).toBe("ship-building/components.yaml");
    } finally {
      fixture.cleanup();
    }
  });

  it("detects a ship component upgrade cycle naming the members (COMPONENT_UPGRADE_CYCLE)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/components.yaml",
        `components:${componentYamlWith("comp_a", ["comp_b"])}${componentYamlWith("comp_b", ["comp_a"])}`,
      );
      writeFixture(fixture.path, "ship-building/balance.yaml", `ship:\n  dummy: 1\n`);

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          ...shipBuildingInput(fixture.path),
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const cycle = collector.errors.find((d) => d.code === "COMPONENT_UPGRADE_CYCLE");
      expect(cycle).toBeDefined();
      expect(cycle!.message).toContain("comp_a");
      expect(cycle!.message).toContain("comp_b");
      expect(cycle!.sourceLocation?.path).toBe("ship-building/components.yaml");
    } finally {
      fixture.cleanup();
    }
  });

  it("accepts an acyclic component upgrade chain (positive control)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/components.yaml",
        `components:${componentYamlWith("comp_a", ["comp_b"])}${componentYamlWith("comp_b", [])}`,
      );
      writeFixture(fixture.path, "ship-building/balance.yaml", `ship:\n  dummy: 1\n`);

      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          ...shipBuildingInput(fixture.path),
        },
        new AbortController().signal,
        collector,
      );

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();
    } finally {
      fixture.cleanup();
    }
  });
});
