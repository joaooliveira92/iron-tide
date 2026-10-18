import { describe, it, expect } from "vite-plus/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { ReferenceDesignSchema, decodeStrictResult, parseYamlSafe } from "@bluewave/content-schema";
import type { CompilerInput } from "../src/index.js";
import { Compiler } from "../src/index.js";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = resolve(tmpdir(), `bw-schema-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFixture(base: string, rel: string, content: string): void {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

const EMPTY_INPUT: Omit<CompilerInput, "manifestPath" | "contentDir"> = {
  rulesetFiles: [],
  countryFiles: [],
  areaFiles: [],
  routeFiles: [],
  possessionFiles: [],
  portFiles: [],
  technologyFiles: [],
};

function compileFile(
  rel: string,
  content: string,
  group: keyof CompilerInput,
): DiagnosticCollector {
  const fixture = createFixtureDir();
  try {
    writeFixture(
      fixture.path,
      "pack.json",
      JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
    );
    writeFixture(fixture.path, rel, content);
    const collector = new DiagnosticCollector();
    const input = {
      manifestPath: "pack.json",
      contentDir: fixture.path,
      ...EMPTY_INPUT,
      [group]: [resolve(fixture.path, rel)],
    } as CompilerInput;
    new Compiler().compile(input, new AbortController().signal, collector);
    return collector;
  } finally {
    fixture.cleanup();
  }
}

function firstSchemaError(collector: DiagnosticCollector): { message: string; path?: string } {
  const error = collector.errors.find((d) => d.code === "SCHEMA");
  expect(error).toBeDefined();
  return { message: error!.message, path: error!.sourceLocation?.path };
}

const REFERENCE_DESIGN = `
designs:
  - id: "rd_1"
    name: "Reference One"
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
        hullFormId: "pre_dreadnought_form"
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
        plantId: "compound_cylindrical"
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

const DESIGN = `
- designId: "des_a"
  designVersionId: "des_a"
  designFamilyId: "fam_a"
  nationId: "uk"
  className: "Alpha"
  hullType: "ironclad_turret_ship"
  displacementKg: 9000000
  speedUms: 8
  armorBeltUm: 300
  mainGuns: { caliber: 305, count: 4, mounts: 2 }
  machineryType: "reciprocating_compound"
  hitPoints: 40
  crewComplement: 400
`;

const FLEET = `
- id: "fleet_a"
  nationId: "uk"
  name: "Home Fleet"
  locationAreaId: "eng"
  ships:
    - id: "ship_a"
      name: "Ship A"
      classId: "Alpha"
      hitPoints: 40
      maxHitPoints: 40
      speed: 15
      firepower: 24
      armor: 24
      isUnderConstruction: false
      constructionProgress: 0
      constructionTotalWork: 0
`;

const ECONOMY = `
- nationId: "uk"
  treasury: 1000
  income: 100
  expenses: 38
`;
const CONSTRUCTION = `
- id: "con_a"
  nationId: "uk"
  type: "ship"
  targetId: "ship_a"
  totalWork: 100
  completedWork: 0
  paidWork: 0
  status: "ACTIVE"
  startedAt: "1880-01"
`;
const RESEARCH = `
- nationId: "uk"
  researchBudget: 60
  technologies: []
`;
const DIPLOMACY = `
- nationA: "uk"
  nationB: "france"
  relation: "neutral"
`;

describe("content schema coverage — reference designs (CAH-SCH-1/4)", () => {
  it("accepts a schema-complete reference design (positive control)", () => {
    const parsed = parseYamlSafe(REFERENCE_DESIGN, "starters.yaml", new DiagnosticCollector());
    expect(parsed.success).toBe(true);
    const design = (parsed.data as { designs: unknown[] }).designs[0];
    expect(decodeStrictResult(ReferenceDesignSchema, design)._tag).toBe("Success");
  });

  it("rejects a missing required field naming the file and field path", () => {
    const collector = compileFile(
      "ship-building/reference-designs/uk/starters.yaml",
      REFERENCE_DESIGN.replace("        draught: 7000\n", ""),
      "referenceDesignFiles",
    );
    const error = firstSchemaError(collector);
    expect(error.path).toBe("ship-building/reference-designs/uk/starters.yaml");
    expect(error.message).toContain("draft.hull");
  });

  it("rejects a wrong-typed field naming the file and field path", () => {
    const collector = compileFile(
      "ship-building/reference-designs/uk/starters.yaml",
      REFERENCE_DESIGN.replace("        lengthWl: 90000", '        lengthWl: "long"'),
      "referenceDesignFiles",
    );
    const error = firstSchemaError(collector);
    expect(error.path).toBe("ship-building/reference-designs/uk/starters.yaml");
    expect(error.message).toContain("draft.hull.lengthWl");
  });

  it("rejects an excess key naming the file and field path", () => {
    const collector = compileFile(
      "ship-building/reference-designs/uk/starters.yaml",
      REFERENCE_DESIGN.replace(
        "        growthReserveBp: 0",
        "        growthReserveBp: 0\n        bogus: 1",
      ),
      "referenceDesignFiles",
    );
    const error = firstSchemaError(collector);
    expect(error.path).toBe("ship-building/reference-designs/uk/starters.yaml");
    expect(error.message).toContain("bogus");
  });
});

describe("content schema coverage — campaign-file collections (CAH-SCH-2/4)", () => {
  const cases: ReadonlyArray<{
    rel: string;
    group: keyof CompilerInput;
    valid: string;
    missing: [string, string];
    typed: [string, string];
  }> = [
    {
      rel: "fleets.yaml",
      group: "fleetFiles",
      valid: FLEET,
      missing: ['  name: "Home Fleet"\n', ""],
      typed: ['  name: "Home Fleet"', "  name: 123"],
    },
    {
      rel: "economies.yaml",
      group: "economyFiles",
      valid: ECONOMY,
      missing: ["  treasury: 1000\n", ""],
      typed: ["  treasury: 1000", '  treasury: "lots"'],
    },
    {
      rel: "constructions.yaml",
      group: "constructionFiles",
      valid: CONSTRUCTION,
      missing: ['  status: "ACTIVE"\n', ""],
      typed: ["  totalWork: 100", '  totalWork: "many"'],
    },
    {
      rel: "research.yaml",
      group: "researchFiles",
      valid: RESEARCH,
      missing: ["  researchBudget: 60\n", ""],
      typed: ["  technologies: []", '  technologies: "none"'],
    },
    {
      rel: "designs.yaml",
      group: "designFiles",
      valid: DESIGN,
      missing: ['  className: "Alpha"\n', ""],
      typed: ["  hitPoints: 40", '  hitPoints: "many"'],
    },
    {
      rel: "diplomacy.yaml",
      group: "diplomacyFiles",
      valid: DIPLOMACY,
      missing: ['  relation: "neutral"\n', ""],
      typed: ['  relation: "neutral"', "  relation: 5"],
    },
  ];

  for (const { rel, group, valid, missing, typed } of cases) {
    it(`accepts a schema-complete ${rel} record (positive control)`, () => {
      const collector = compileFile(rel, valid, group);
      expect(collector.hasErrors).toBe(false);
    });

    it(`rejects a missing required field on a ${rel} record naming the file and field path`, () => {
      const collector = compileFile(rel, valid.replace(missing[0], missing[1]), group);
      const error = firstSchemaError(collector);
      expect(error.path).toContain(rel);
      expect(error.message).toContain("Missing key");
    });

    it(`rejects a wrong-typed field on a ${rel} record naming the file and field path`, () => {
      const collector = compileFile(rel, valid.replace(typed[0], typed[1]), group);
      const error = firstSchemaError(collector);
      expect(error.path).toContain(rel);
    });

    it(`rejects an excess key on a ${rel} record naming the file and field path`, () => {
      const collector = compileFile(rel, `${valid}\n  bogus: 1\n`, group);
      const error = firstSchemaError(collector);
      expect(error.path).toContain(rel);
      expect(error.message).toContain("bogus");
    });
  }

  it("does not false-positive when a collection is absent from a pack", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(
        { manifestPath: "pack.json", contentDir: fixture.path, ...EMPTY_INPUT },
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
