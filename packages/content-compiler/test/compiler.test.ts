import { describe, it, expect } from "vite-plus/test";
import { Compiler } from "../src/index.js";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-test-"));
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

const jsonDocument = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

function nationRecord(
  id: string,
  tag: string,
  name: string,
  isPlayable = false,
  homeArea?: string,
): Record<string, unknown> {
  return {
    id,
    tag,
    name,
    displayNameKey: `nation.${id}`,
    isPlayable,
    ...(homeArea === undefined ? {} : { homeArea }),
    slot: null,
    presentation: { colorBg: "#C8102E", colorFg: "#FFFFFF" },
    identity: { oneSentence: "x", fullIdentity: "x", strategicProblem: "x" },
    traits: [],
    regime: {
      type: "monarchy",
      politicalSystem: "constitutional_monarchy",
      governmentType: "limited_democracy",
      headOfState: "x",
      headOfGovernment: "x",
      leaderTitle: "x",
      navalPolicyActors: [],
      governmentModifiers: [],
      stabilityProfile: { level: "high", factors: [] },
      description: "x",
    },
    strategicObjectives: { primary: "x", secondary: "x" },
    baseResources: {
      gdpTier: "great_power",
      gdpDescription: "x",
      population: "x",
      industrialization: "industrial",
      industrializationDescription: "x",
    },
    navalAppropriation: { budgetLevel: "moderate", justification: "x" },
    economy: {
      description: "x",
      character: "x",
      strengths: [],
      weaknesses: [],
      industrialBase: "mature_global",
    },
    navalInstitution: { description: "x", character: [], seniority: "senior_service" },
    doctrine: { summary: "x", schools: [] },
    shipDesign: { summary: "x", principles: [], favoredTypes: [] },
    ai: { archetype: "status_quo_maritime_hegemon", behavior: [] },
    navalPurpose: "sustain_global_empire",
    coreAnxiety: "loss_of_sea_control_overstretch",
    gameplayFeel: "manage_supremacy",
    historicalAssumptions: [],
  };
}

function nationDocument(
  id: string,
  tag: string,
  name: string,
  isPlayable = false,
  homeArea?: string,
): string {
  return jsonDocument([nationRecord(id, tag, name, isPlayable, homeArea)]);
}

function componentRecord(id: string, upgradePath: readonly string[] = []): Record<string, unknown> {
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

function componentsDocument(records: readonly Record<string, unknown>[]): string {
  return jsonDocument({ components: records });
}

function shipBuildingInput(fixturePath: string): Record<string, string[]> {
  return {
    shipComponentFiles: [resolve(fixturePath, "ship-building/components.json")],
    shipBalanceFiles: [resolve(fixturePath, "ship-building/balance.json")],
  };
}

function referenceDesignDocument(id: string, hullFormId: string, plantId: string): string {
  return jsonDocument({
    designs: [
      {
        id,
        name: `Reference ${id}`,
        month: "1880-01",
        draft: {
          nationId: "uk",
          requirement: {
            category: "B",
            requiredSpeedMilliKnots: 15000,
            cruiseSpeedMilliKnots: 8000,
            requiredRangeNm: 3000,
            designThreatId: "rml_10in",
            modernizationExpectation: "MINOR",
            crewQualityBp: 10000,
            accommodationStandard: "STANDARD",
          },
          hull: {
            hullFormId,
            lengthWl: 90000,
            beam: 18000,
            draught: 7000,
            depthToMainDeck: 9000,
            blockCoeffBp: 6000,
            materialId: "iron",
            structuralSchemeId: "mixed",
            subdivisionGrade: 2,
            targetDisplacementKg: 9000000,
            limitDisplacementKg: null,
            designMarginBp: 300,
            growthReserveBp: 0,
          },
          machinery: {
            plantId,
            installedKw: 5000,
            zoneId: "CENTRAL_MACHINERY",
            stationPermille: 400,
            fuelCapacityKg: 500000,
            fuelZoneId: "CENTRAL_MACHINERY",
            fuelStationPermille: 450,
            foulingBp: 0,
          },
          armour: {
            regions: [],
            citadelLengthMm: 0,
            torpedoWarheadKg: 20,
            bunkerProtectionBp: 0,
          },
          placements: [],
        },
      },
    ],
  });
}

describe("Compiler", () => {
  it("compiles the full ship-building surface into one bundled artifact", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "ship-building/components.json",
        componentsDocument([componentRecord("comp_a"), componentRecord("comp_b")]),
      );
      writeFixture(
        fixture.path,
        "ship-building/balance.json",
        jsonDocument({ ship: { dummy: 1 } }),
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
        "ship-building/components.json",
        componentsDocument([componentRecord("comp_a"), componentRecord("comp_a")]),
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
          shipComponentFiles: [resolve(fixture.path, "ship-building/components.json")],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const dup = collector.errors.find((d) => d.code === "DUP-ID");
      expect(dup).toBeDefined();
      expect(dup!.sourceLocation?.path).toBe("ship-building/components.json");
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
        "ship-building/reference-designs/uk/starters.json",
        referenceDesignDocument("rd_1", "missing_form", "missing_plant"),
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
            resolve(fixture.path, "ship-building/reference-designs/uk/starters.json"),
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
          (d) => d.sourceLocation?.path === "ship-building/reference-designs/uk/starters.json",
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
            countries: ["countries.json"],
            areas: ["areas.json"],
            rulesets: ["rulesets.json"],
          },
        }),
      );

      writeFixture(
        fixture.path,
        "countries.json",
        nationDocument("uk", "GBR", "United Kingdom", true, "lon"),
      );

      writeFixture(
        fixture.path,
        "areas.json",
        `
[
  {
    "id": "lon",
    "name": "London",
    "type": "land",
    "controller": "uk"
  }
]
`,
      );

      writeFixture(
        fixture.path,
        "rulesets.json",
        `
[
  {
    "id": "core",
    "name": "Core Rules",
    "version": "1.0"
  }
]
`,
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [resolve(fixture.path, "rulesets.json")],
          countryFiles: [resolve(fixture.path, "countries.json")],
          areaFiles: [resolve(fixture.path, "areas.json")],
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
          files: { countries: ["countries.json"] },
        }),
      );

      writeFixture(
        fixture.path,
        "countries.json",
        jsonDocument([
          nationRecord("uk", "GBR", "United Kingdom"),
          nationRecord("uk", "GBR", "United Kingdom"),
        ]),
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.json")],
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
            possessions: ["possessions.json"],
            countries: ["countries.json"],
            areas: ["areas.json"],
          },
        }),
      );

      writeFixture(fixture.path, "countries.json", nationDocument("uk", "GBR", "United Kingdom"));
      writeFixture(
        fixture.path,
        "areas.json",
        jsonDocument([{ id: "lon", name: "London", type: "land" }]),
      );
      writeFixture(
        fixture.path,
        "possessions.json",
        jsonDocument([{ id: "uk-lon", nationId: "uk", areaId: "nonexistent" }]),
      );

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.json")],
          areaFiles: [resolve(fixture.path, "areas.json")],
          routeFiles: [],
          possessionFiles: [resolve(fixture.path, "possessions.json")],
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
          files: { countries: ["countries.json"], areas: ["areas.json"] },
        }),
      );

      writeFixture(
        fixture.path,
        "countries.json",
        nationDocument("uk", "GBR", "United Kingdom", false, "lon"),
      );
      writeFixture(
        fixture.path,
        "areas.json",
        `
[
  {
    "id": "lon",
    "name": "London",
    "type": "land",
    "controller": "uk"
  }
]
`,
      );

      const compiler = new Compiler();
      const signal = new AbortController().signal;

      const collector1 = new DiagnosticCollector();
      const output1 = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.json")],
          areaFiles: [resolve(fixture.path, "areas.json")],
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
          countryFiles: [resolve(fixture.path, "countries.json")],
          areaFiles: [resolve(fixture.path, "areas.json")],
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
          files: { countries: ["countries.json"] },
        }),
      );

      writeFixture(fixture.path, "countries.json", nationDocument("uk", "GBR", "United Kingdom"));

      const compiler = new Compiler();
      const collector = new DiagnosticCollector();
      const controller = new AbortController();
      controller.abort();

      const output = compiler.compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: [resolve(fixture.path, "countries.json")],
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
          files: { technologies: ["technologies.json"] },
        }),
      );

      writeFixture(
        fixture.path,
        "technologies.json",
        `
[
  {
    "id": "tech_a",
    "name": "Tech A",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION"
  },
  {
    "id": "tech_b",
    "name": "Tech B",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION",
    "prerequisites": [
      {
        "techId": "tech_c"
      }
    ]
  },
  {
    "id": "tech_c",
    "name": "Tech C",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION",
    "prerequisites": [
      {
        "techId": "tech_b"
      }
    ]
  }
]
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
          technologyFiles: [resolve(fixture.path, "technologies.json")],
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
          files: { technologies: ["technologies.json"] },
        }),
      );
      writeFixture(
        fixture.path,
        "technologies.json",
        `
[
  {
    "id": "tech_a",
    "name": "Tech A",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION",
    "prerequisites": [
      {
        "techId": "tech_b"
      }
    ]
  },
  {
    "id": "tech_b",
    "name": "Tech B",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION",
    "prerequisites": [
      {
        "techId": "tech_a"
      }
    ]
  }
]
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
          technologyFiles: [resolve(fixture.path, "technologies.json")],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const cycle = collector.errors.find((d) => d.code === "TECHNOLOGY_PREREQUISITE_CYCLE");
      expect(cycle).toBeDefined();
      expect(cycle!.message).toContain("tech_a");
      expect(cycle!.message).toContain("tech_b");
      expect(cycle!.sourceLocation?.path).toBe("technologies.json");
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
          files: { technologies: ["technologies.json"] },
        }),
      );
      writeFixture(
        fixture.path,
        "technologies.json",
        `
[
  {
    "id": "tech_a",
    "name": "Tech A",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION",
    "prerequisites": [
      {
        "techId": "tech_a"
      }
    ]
  }
]
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
          technologyFiles: [resolve(fixture.path, "technologies.json")],
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const selfRef = collector.errors.find((d) => d.code === "SELF_REFERENCE");
      expect(selfRef).toBeDefined();
      expect(selfRef!.entityId).toBe("tech_a");
      expect(selfRef!.sourceLocation?.path).toBe("technologies.json");
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
          files: { technologies: ["technologies.json"] },
        }),
      );
      writeFixture(
        fixture.path,
        "technologies.json",
        `
[
  {
    "id": "tech_a",
    "name": "Tech A",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION"
  },
  {
    "id": "tech_b",
    "name": "Tech B",
    "category": "hull",
    "researchFieldId": "HULL_CONSTRUCTION",
    "prerequisites": [
      {
        "techId": "tech_a"
      }
    ]
  }
]
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
          technologyFiles: [resolve(fixture.path, "technologies.json")],
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
        "ship-building/components.json",
        componentsDocument([componentRecord("comp_a", ["comp_a"])]),
      );
      writeFixture(
        fixture.path,
        "ship-building/balance.json",
        jsonDocument({ ship: { dummy: 1 } }),
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
          ...shipBuildingInput(fixture.path),
        },
        new AbortController().signal,
        collector,
      );

      expect(output).toBeUndefined();
      const selfRef = collector.errors.find((d) => d.code === "SELF_REFERENCE");
      expect(selfRef).toBeDefined();
      expect(selfRef!.entityId).toBe("comp_a");
      expect(selfRef!.sourceLocation?.path).toBe("ship-building/components.json");
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
        "ship-building/components.json",
        componentsDocument([
          componentRecord("comp_a", ["comp_b"]),
          componentRecord("comp_b", ["comp_a"]),
        ]),
      );
      writeFixture(
        fixture.path,
        "ship-building/balance.json",
        jsonDocument({ ship: { dummy: 1 } }),
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
      expect(cycle!.sourceLocation?.path).toBe("ship-building/components.json");
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
        "ship-building/components.json",
        componentsDocument([componentRecord("comp_a", ["comp_b"]), componentRecord("comp_b")]),
      );
      writeFixture(
        fixture.path,
        "ship-building/balance.json",
        jsonDocument({ ship: { dummy: 1 } }),
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

  it("tells a file that cannot be read from one that is missing", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
      );
      mkdirSync(resolve(fixture.path, "countries.json"));

      const collector = new DiagnosticCollector();
      new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          rulesetFiles: [],
          countryFiles: ["countries.json", "missing.json"],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
        },
        new AbortController().signal,
        collector,
      );

      const messages = collector.errors
        .filter((diagnostic) => diagnostic.code === "FILE-READ")
        .map((diagnostic) => diagnostic.message);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toContain("countries.json");
      expect(messages[0]).toContain("EISDIR");
      expect(messages[1]).toContain("absent from the compiler input");
    } finally {
      fixture.cleanup();
    }
  });
});
